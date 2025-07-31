import jwt from "jsonwebtoken";


export const generateToken = (userId, res) => {
  const token = jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });

  const isProd = process.env.NODE_ENV === "production";

  // Still set cookie for backward compatibility (desktop browsers)
  res.cookie("jwt", token, {
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
    httpOnly: true,
    secure: isProd, // HTTPS-only in production
    sameSite: isProd ? "none" : "lax",
    path: "/", // available on every endpoint
  });

  return token;
};
