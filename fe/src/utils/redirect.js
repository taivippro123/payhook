/**
 * Get redirect path based on user role
 * @param {Object} user - User object with role
 * @returns {string} Redirect path
 */
export function getRedirectPath(user) {
  if (!user) {
    return '/login'
  }
  
  if (user.role === 'admin') {
    return '/admin'
  }
  
  return '/dashboard'
}

