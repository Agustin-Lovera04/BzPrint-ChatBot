import crypto from "crypto";
import { config } from "../config/config.js";

export function verifyMetaSignature(req, res, next) {
  const signature = req.get("X-Hub-Signature-256");
  if (!signature || !req.rawBody) {
    return res.sendStatus(401);
  }

  const expected = "sha256=" + crypto
    .createHmac("sha256", config.META_APP_SECRET)
    .update(req.rawBody)
    .digest("hex");

  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expected);

  if (sigBuf.length !== expBuf.length) return res.sendStatus(401);
  if (!crypto.timingSafeEqual(sigBuf, expBuf)) return res.sendStatus(401);

  next();
}
