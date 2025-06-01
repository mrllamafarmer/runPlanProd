"""Custom exceptions for the GPX Route Analyzer application."""

class GPXAnalyzerException(Exception):
    """Base exception for GPX Analyzer application"""
    def __init__(self, message: str, details: str = None):
        self.message = message
        self.details = details
        super().__init__(self.message)

class DatabaseException(GPXAnalyzerException):
    """Raised when database operations fail"""
    pass

# Alias for new naming convention
class DatabaseError(DatabaseException):
    """Raised when database operations fail (PostgreSQL version)"""
    pass

class AuthenticationError(GPXAnalyzerException):
    """Raised when authentication fails"""
    pass

class ValidationError(GPXAnalyzerException):
    """Raised when data validation fails (updated naming)"""
    pass

class RouteNotFoundException(GPXAnalyzerException):
    """Raised when a requested route is not found"""
    pass

class WaypointNotFoundException(GPXAnalyzerException):
    """Raised when a requested waypoint is not found"""
    pass

class ValidationException(ValidationError):
    """Raised when data validation fails (legacy naming)"""
    pass

class FileProcessingException(GPXAnalyzerException):
    """Raised when file processing fails"""
    pass

class ConfigurationException(GPXAnalyzerException):
    """Raised when there are configuration issues"""
    pass 