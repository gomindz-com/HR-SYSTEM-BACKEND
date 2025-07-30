import jwt from "jsonwebtoken";
export const generateToken = (userId, res) => {
  const token = jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });

  const cookieOptions = {
    maxAge: 7 * 24 * 60 * 60 * 1000,
    httpOnly: true,
    sameSite: process.env.NODE_ENV === "development" ? "strict" : "none",
    secure: process.env.NODE_ENV !== "development",
    path: "/",
  };

  // Set domain for production cross-domain cookies
  if (process.env.NODE_ENV !== "development") {
    const backendUrl = new URL("https://hr-system-backend-v7z2.onrender.com");
    cookieOptions.domain = backendUrl.hostname;
  }

  res.cookie("jwt", token, cookieOptions);
  return token;
};
