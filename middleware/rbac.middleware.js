export const requireRole = (allowedRoles) => {
    return async (req, res, next) => {
      // Ensure user is authenticated (set by verifyToken middleware)
      if (!req.user) {
        return res.status(401).json({ 
          message: "Unauthorized. Please authenticate first." 
        });
      }
  
      // Normalize allowedRoles to array (handles both string and array inputs)
      const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
  
      // Check if user's role is in the allowed roles
      if (!roles.includes(req.user.role)) {
        return res.status(403).json({ 
          message: `Access denied. Required role(s): ${roles.join(', ')}` 
        });
      }
  
      next();
    };
  };