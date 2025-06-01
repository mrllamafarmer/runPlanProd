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

class RouteNotFoundException(GPXAnalyzerException):
    """Raised when a requested route is not found"""
    pass

class WaypointNotFoundException(GPXAnalyzerException):
    """Raised when a requested waypoint is not found"""
    pass

class ValidationException(GPXAnalyzerException):
    """Raised when data validation fails"""
    pass

class FileProcessingException(GPXAnalyzerException):
    """Raised when file processing fails"""
    pass

class ConfigurationException(GPXAnalyzerException):
    """Raised when there are configuration issues"""
    pass 