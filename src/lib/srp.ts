// AWS Cognito SRP (Secure Remote Password) auth, implemented for Cloudflare Workers
// using only standards-track Web APIs (BigInt, crypto.subtle, TextEncoder).
//
// Reference: https://docs.aws.amazon.com/cognito/latest/developerguide/amazon-cognito-user-pools-authentication-flow.html
// AWS uses SRP-6a with N = 3072-bit prime, g = 2, hash = SHA-256, plus a custom HKDF.

// 3072-bit prime N from RFC 5054 group 14? AWS uses RFC 5054 group N (a specific 3072-bit prime).
// This is the well-known prime used by AWS Cognito.
const N_HEX =
  "FFFFFFFFFFFFFFFFC90FDAA22168C234C4C6628B80DC1CD129024E08" +
  "8A67CC74020BBEA63B139B22514A08798E3404DDEF9519B3CD3A431B" +
  "302B0A6DF25F14374FE1356D6D51C245E485B576625E7EC6F44C42E9" +
  "A637ED6B0BFF5CB6F406B7EDEE386BFB5A899FA5AE9F24117C4B1FE6" +
  "49286651ECE45B3DC2007CB8A163BF0598DA48361C55D39A69163FA8" +
  "FD24CF5F83655D23DCA3AD961C62F356208552BB9ED529077096966D" +
  "670C354E4ABC9804F1746C08CA18217C32905E462E36CE3BE39E772C" +
  "180E86039B2783A2EC07A28FB5C55DF06F4C52C9DE2BCBF695581718" +
  "3995497CEA956AE515D2261898FA051015728E5A8AAAC42DAD33170D" +
  "04507A33A85521ABDF1CBA64ECFB850458DBEF0A8AEA71575D060C7D" +
  "B3970F85A6E1E4C7ABF5AE8CDB0933D71E8C94E04A25619DCEE3D226" +
  "1AD2EE6BF12FFA06D98A0864D87602733EC86A64521F2B18177B200C" +
  "BBE117577A615D6C770988C0BAD946E208E24FA074E5AB3143DB5BFC" +
  "E0FD108E4B82D120A93AD2CAFFFFFFFFFFFFFFFF";

const G_HEX = "2";

const N = BigInt("0x" + N_HEX);
const G = BigInt("0x" + G_HEX);

const enc = new TextEncoder();

function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2) hex = "0" + hex;
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
  return out;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function bigIntToHex(n: bigint): string {
  let h = n.toString(16);
  if (h.length % 2) h = "0" + h;
  return h;
}

// Pad hex with a leading 00 if its top bit is set, per Cognito's serialization quirks.
function padHex(h: string): string {
  if (h.length % 2) h = "0" + h;
  if (parseInt(h[0], 16) >= 8) h = "00" + h;
  return h;
}

async function sha256(data: Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", data as BufferSource));
}

async function hexHash(hex: string): Promise<string> {
  return bytesToHex(await sha256(hexToBytes(hex)));
}

function concatBytes(...arrs: Uint8Array[]): Uint8Array {
  const total = arrs.reduce((n, a) => n + a.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const a of arrs) {
    out.set(a, off);
    off += a.length;
  }
  return out;
}

async function hmacSha256(key: Uint8Array, msg: Uint8Array): Promise<Uint8Array> {
  const k = await crypto.subtle.importKey("raw", key as BufferSource, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", k, msg as BufferSource));
}

// AWS-specific HKDF using SHA-256, no info salt — exact same as Cognito's PasswordAuthenticationKey impl.
async function awsHkdf(ikm: Uint8Array, salt: Uint8Array): Promise<Uint8Array> {
  const prk = await hmacSha256(salt, ikm);
  const info = enc.encode("Caldera Derived Key");
  const t1 = await hmacSha256(prk, concatBytes(info, new Uint8Array([1])));
  return t1.slice(0, 16);
}

// Constant-time-ish modular exponentiation for BigInt (left-to-right binary).
function modPow(base: bigint, exp: bigint, mod: bigint): bigint {
  let result = 1n;
  base = base % mod;
  let e = exp;
  while (e > 0n) {
    if (e & 1n) result = (result * base) % mod;
    e >>= 1n;
    base = (base * base) % mod;
  }
  return result;
}

function randomBigInt(byteLen: number): bigint {
  const buf = new Uint8Array(byteLen);
  crypto.getRandomValues(buf);
  return BigInt("0x" + bytesToHex(buf));
}

export interface CognitoTokens {
  IdToken: string;
  AccessToken: string;
  RefreshToken: string;
  ExpiresIn: number;
  TokenType: string;
}

const KCal = (async () => {
  // k = H(N || g)
  return BigInt("0x" + (await hexHash(padHex(N_HEX) + padHex(G_HEX))));
})();

export async function cognitoSrpLogin(args: {
  region: string;
  userPoolId: string;
  clientId: string;
  username: string;
  password: string;
}): Promise<CognitoTokens> {
  const { region, userPoolId, clientId, username, password } = args;
  const cognitoUrl = `https://cognito-idp.${region}.amazonaws.com/`;
  const userPoolName = userPoolId.split("_")[1];

  // 1) Generate client SRP_a, SRP_A.
  const a = randomBigInt(128);
  const A = modPow(G, a, N);
  if (A % N === 0n) throw new Error("SRP_A is zero");
  const srpA = padHex(bigIntToHex(A));

  // 2) InitiateAuth USER_SRP_AUTH
  const initRes = await fetch(cognitoUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-amz-json-1.1",
      "X-Amz-Target": "AWSCognitoIdentityProviderService.InitiateAuth",
    },
    body: JSON.stringify({
      AuthFlow: "USER_SRP_AUTH",
      ClientId: clientId,
      AuthParameters: { USERNAME: username, SRP_A: srpA },
    }),
  });
  if (!initRes.ok) throw new Error(`InitiateAuth ${initRes.status}: ${await initRes.text()}`);
  const init = (await initRes.json()) as {
    ChallengeName?: string;
    ChallengeParameters: {
      USER_ID_FOR_SRP: string;
      SRP_B: string;
      SALT: string;
      SECRET_BLOCK: string;
    };
  };

  if (init.ChallengeName !== "PASSWORD_VERIFIER") {
    throw new Error(`Unexpected challenge: ${init.ChallengeName}`);
  }
  const userIdForSrp = init.ChallengeParameters.USER_ID_FOR_SRP;
  const srpB = init.ChallengeParameters.SRP_B;
  const salt = init.ChallengeParameters.SALT;
  const secretBlock = init.ChallengeParameters.SECRET_BLOCK;
  const B = BigInt("0x" + srpB);
  if (B % N === 0n) throw new Error("SRP_B is zero");

  // 3) u = H(A || B)
  const u = BigInt("0x" + (await hexHash(padHex(bigIntToHex(A)) + padHex(srpB))));
  if (u === 0n) throw new Error("u is zero");

  // 4) x = H(salt || H(poolName || username || ':' || password))
  const innerHashHex = bytesToHex(
    await sha256(enc.encode(`${userPoolName}${userIdForSrp}:${password}`))
  );
  const xHex = await hexHash(padHex(salt) + innerHashHex);
  const x = BigInt("0x" + xHex);

  // 5) k = H(N || g) ; gx = g^x ; intermediate = (B - k * gx) mod N ; S = (intermediate)^(a + u*x) mod N
  const k = await KCal;
  const gx = modPow(G, x, N);
  let intermediate = (B - ((k * gx) % N) + N * 2n) % N; // ensure positive
  const S = modPow(intermediate, a + u * x, N);

  // 6) HKDF derive password authentication key
  const hkdf = await awsHkdf(hexToBytes(padHex(bigIntToHex(S))), hexToBytes(padHex(bigIntToHex(u))));

  // 7) Build PASSWORD_CLAIM_SIGNATURE = HMAC(hkdf, poolName || userIdForSrp || secretBlock || timestamp)
  const now = new Date();
  // AWS expects: "EEE MMM d HH:mm:ss UTC yyyy" (English locale, single-digit day no zero pad)
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  const pad2 = (n: number) => String(n).padStart(2, "0");
  const timestamp =
    `${days[now.getUTCDay()]} ${months[now.getUTCMonth()]} ${now.getUTCDate()} ` +
    `${pad2(now.getUTCHours())}:${pad2(now.getUTCMinutes())}:${pad2(now.getUTCSeconds())} UTC ` +
    `${now.getUTCFullYear()}`;

  const secretBlockBytes = Uint8Array.from(atob(secretBlock), (c) => c.charCodeAt(0));
  const claimMsg = concatBytes(
    enc.encode(userPoolName),
    enc.encode(userIdForSrp),
    secretBlockBytes,
    enc.encode(timestamp)
  );
  const sig = await hmacSha256(hkdf, claimMsg);
  const sigB64 = btoa(String.fromCharCode(...sig));

  // 8) RespondToAuthChallenge
  const respRes = await fetch(cognitoUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-amz-json-1.1",
      "X-Amz-Target": "AWSCognitoIdentityProviderService.RespondToAuthChallenge",
    },
    body: JSON.stringify({
      ClientId: clientId,
      ChallengeName: "PASSWORD_VERIFIER",
      ChallengeResponses: {
        USERNAME: userIdForSrp,
        PASSWORD_CLAIM_SECRET_BLOCK: secretBlock,
        PASSWORD_CLAIM_SIGNATURE: sigB64,
        TIMESTAMP: timestamp,
      },
    }),
  });
  if (!respRes.ok) throw new Error(`RespondToAuthChallenge ${respRes.status}: ${await respRes.text()}`);
  const resp = (await respRes.json()) as {
    AuthenticationResult?: {
      IdToken: string;
      AccessToken: string;
      RefreshToken: string;
      ExpiresIn: number;
      TokenType: string;
    };
    ChallengeName?: string;
  };
  if (!resp.AuthenticationResult) {
    throw new Error(`Auth failed: ${JSON.stringify(resp)}`);
  }
  return resp.AuthenticationResult;
}
