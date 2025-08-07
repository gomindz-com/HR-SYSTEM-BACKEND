import jwt from "jsonwebtoken";

export const generateToken = (userId, res) => {
  const token = jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });

  const isProd = process.env.NODE_ENV === "production";

  // Set cookie with mobile-friendly configuration
  res.cookie("jwt", token, {
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
    httpOnly: true,
    secure: isProd, // HTTPS-only in production
    sameSite: isProd ? "none" : "lax", // Use 'lax' for development to allow cross-origin
    path: "/", // available on every endpoint
    // Add domain if needed for production
    // domain: isProd ? '.yourdomain.com' : undefined,
  });

  return token;
};
