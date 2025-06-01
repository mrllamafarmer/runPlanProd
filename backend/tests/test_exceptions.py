import pytest

from exceptions import (
    GPXAnalyzerException, DatabaseException, RouteNotFoundException,
    WaypointNotFoundException, ValidationException, FileProcessingException,
    ConfigurationException
)


class TestExceptions:
    """Test suite for custom exception classes"""

    def test_gpx_analyzer_exception_basic(self):
        """Test basic GPXAnalyzerException creation"""
        message = "Test error message"
        exception = GPXAnalyzerException(message)
        
        assert str(exception) == message
        assert exception.message == message
        assert exception.details is None

    def test_gpx_analyzer_exception_with_details(self):
        """Test GPXAnalyzerException with details"""
        message = "Test error message"
        details = "Additional error details"
        exception = GPXAnalyzerException(message, details)
        
        assert str(exception) == message
        assert exception.message == message
        assert exception.details == details

    def test_database_exception_inheritance(self):
        """Test DatabaseException inherits from GPXAnalyzerException"""
        message = "Database error"
        exception = DatabaseException(message)
        
        assert isinstance(exception, GPXAnalyzerException)
        assert str(exception) == message
        assert exception.message == message

    def test_database_exception_with_details(self):
        """Test DatabaseException with details"""
        message = "Database connection failed"
        details = "Connection timeout after 30 seconds"
        exception = DatabaseException(message, details)
        
        assert exception.message == message
        assert exception.details == details

    def test_route_not_found_exception(self):
        """Test RouteNotFoundException"""
        route_id = "123e4567-e89b-12d3-a456-426614174000"
        message = f"Route with ID {route_id} not found"
        exception = RouteNotFoundException(message)
        
        assert isinstance(exception, GPXAnalyzerException)
        assert str(exception) == message
        assert exception.message == message

    def test_waypoint_not_found_exception(self):
        """Test WaypointNotFoundException"""
        waypoint_id = "123e4567-e89b-12d3-a456-426614174000"
        message = f"Waypoint with ID {waypoint_id} not found"
        exception = WaypointNotFoundException(message)
        
        assert isinstance(exception, GPXAnalyzerException)
        assert str(exception) == message
        assert exception.message == message

    def test_validation_exception(self):
        """Test ValidationException"""
        message = "Invalid input data"
        exception = ValidationException(message)
        
        assert isinstance(exception, GPXAnalyzerException)
        assert str(exception) == message
        assert exception.message == message

    def test_validation_exception_with_details(self):
        """Test ValidationException with validation details"""
        message = "Validation failed"
        details = "Field 'distance' must be greater than 0"
        exception = ValidationException(message, details)
        
        assert exception.message == message
        assert exception.details == details

    def test_file_processing_exception(self):
        """Test FileProcessingException"""
        message = "Failed to process GPX file"
        exception = FileProcessingException(message)
        
        assert isinstance(exception, GPXAnalyzerException)
        assert str(exception) == message
        assert exception.message == message

    def test_file_processing_exception_with_details(self):
        """Test FileProcessingException with file details"""
        message = "Invalid GPX format"
        details = "Missing required <gpx> root element"
        exception = FileProcessingException(message, details)
        
        assert exception.message == message
        assert exception.details == details

    def test_configuration_exception(self):
        """Test ConfigurationException"""
        message = "Invalid configuration"
        exception = ConfigurationException(message)
        
        assert isinstance(exception, GPXAnalyzerException)
        assert str(exception) == message
        assert exception.message == message

    def test_configuration_exception_with_details(self):
        """Test ConfigurationException with config details"""
        message = "Database configuration error"
        details = "Missing required environment variable DATABASE_URL"
        exception = ConfigurationException(message, details)
        
        assert exception.message == message
        assert exception.details == details

    def test_exception_inheritance_chain(self):
        """Test that all custom exceptions inherit from GPXAnalyzerException"""
        exceptions = [
            DatabaseException("test"),
            RouteNotFoundException("test"),
            WaypointNotFoundException("test"),
            ValidationException("test"),
            FileProcessingException("test"),
            ConfigurationException("test")
        ]
        
        for exception in exceptions:
            assert isinstance(exception, GPXAnalyzerException)
            assert isinstance(exception, Exception)

    def test_exception_raising_and_catching(self):
        """Test raising and catching custom exceptions"""
        # Test raising and catching specific exception
        with pytest.raises(DatabaseException) as exc_info:
            raise DatabaseException("Database error")
        
        assert "Database error" in str(exc_info.value)
        
        # Test catching as base exception
        with pytest.raises(GPXAnalyzerException):
            raise ValidationException("Validation error")

    def test_exception_chaining(self):
        """Test exception chaining with cause"""
        original_error = ValueError("Original error")
        
        try:
            raise original_error
        except ValueError as e:
            chained_exception = DatabaseException("Database operation failed")
            chained_exception.__cause__ = e
            
            assert chained_exception.__cause__ is original_error

    def test_exception_attributes_persistence(self):
        """Test that exception attributes persist through raise/catch cycle"""
        message = "Test message"
        details = "Test details"
        
        try:
            raise ValidationException(message, details)
        except ValidationException as e:
            assert e.message == message
            assert e.details == details
            assert str(e) == message

    def test_empty_message_handling(self):
        """Test handling of empty or None messages"""
        # Empty string message
        exception = GPXAnalyzerException("")
        assert exception.message == ""
        assert str(exception) == ""
        
        # None message - our custom exception should handle this gracefully
        try:
            exception = GPXAnalyzerException(None)
            assert exception.message is None
            assert str(exception) == "None"
        except TypeError:
            # If it does raise TypeError, that's also acceptable behavior
            pass

    def test_exception_repr(self):
        """Test string representation of exceptions"""
        message = "Test error"
        details = "Test details"
        exception = DatabaseException(message, details)
        
        # The repr should contain the class name and message
        repr_str = repr(exception)
        assert "DatabaseException" in repr_str
        assert message in repr_str 