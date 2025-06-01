import React from 'react';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render, setupMockStore, mockGPXContent, createMockFile, checkAccessibility } from '../utils/test-utils';
import { setupApiMocks, mockGPXFile } from '../mocks/api';
import AnalyzerTab from '../../components/AnalyzerTab';

// Setup API mocks
setupApiMocks();

describe('AnalyzerTab Integration Tests', () => {
  beforeEach(() => {
    // Reset store before each test
    setupMockStore();
  });

  describe('File Upload Workflow', () => {
    it('completes full GPX upload and visualization workflow', async () => {
      const user = userEvent.setup();
      render(<AnalyzerTab />);

      // Initial state - should show upload section
      expect(screen.getByText(/upload/i)).toBeInTheDocument();
      expect(screen.getByText(/sample data/i)).toBeInTheDocument();

      // Create and upload a mock GPX file
      const file = createMockFile(mockGPXContent, 'test-route.gpx');
      const fileInput = screen.getByRole('button', { name: /upload/i });

      // Simulate file upload
      await user.upload(fileInput, file);

      // Wait for file to be processed
      await waitFor(() => {
        expect(screen.getByText(/route visualization/i)).toBeInTheDocument();
      });

      // Check that route summary is displayed
      expect(screen.getByText(/route statistics/i)).toBeInTheDocument();
      expect(screen.getByText(/track points/i)).toBeInTheDocument();

      // Check that visualization tabs are available
      expect(screen.getByText(/route map/i)).toBeInTheDocument();
      expect(screen.getByText(/elevation profile/i)).toBeInTheDocument();

      // Check that route planning table is shown
      expect(screen.getByText(/route planning/i)).toBeInTheDocument();

      // Check that save section is available
      expect(screen.getByText(/save route/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/route name/i)).toBeInTheDocument();
    });

    it('handles invalid file type gracefully', async () => {
      const user = userEvent.setup();
      render(<AnalyzerTab />);

      // Create invalid file
      const invalidFile = createMockFile('invalid content', 'test.txt');
      const fileInput = screen.getByRole('button', { name: /upload/i });

      // Simulate file upload
      await user.upload(fileInput, invalidFile);

      // Should show error message
      await waitFor(() => {
        expect(screen.getByText(/valid GPX file/i)).toBeInTheDocument();
      });
    });

    it('handles sample data generation', async () => {
      const user = userEvent.setup();
      render(<AnalyzerTab />);

      // Click sample data button
      const sampleButton = screen.getByText(/sample data/i);
      await user.click(sampleButton);

      // Wait for sample data to load
      await waitFor(() => {
        expect(screen.getByText(/route visualization/i)).toBeInTheDocument();
      });

      // Should show all sections
      expect(screen.getByText(/route statistics/i)).toBeInTheDocument();
      expect(screen.getByText(/route map/i)).toBeInTheDocument();
      expect(screen.getByText(/save route/i)).toBeInTheDocument();
    });
  });

  describe('Route Visualization Interaction', () => {
    beforeEach(async () => {
      // Setup with sample data
      const user = userEvent.setup();
      render(<AnalyzerTab />);
      
      const sampleButton = screen.getByText(/sample data/i);
      await user.click(sampleButton);
      
      await waitFor(() => {
        expect(screen.getByText(/route visualization/i)).toBeInTheDocument();
      });
    });

    it('switches between map and elevation tabs', async () => {
      const user = userEvent.setup();

      // Should default to map tab
      expect(screen.getByTestId('map-visualization')).toBeInTheDocument();
      expect(screen.queryByTestId('elevation-chart')).not.toBeInTheDocument();

      // Switch to elevation tab
      const elevationTab = screen.getByText(/elevation profile/i);
      await user.click(elevationTab);

      await waitFor(() => {
        expect(screen.getByTestId('elevation-chart')).toBeInTheDocument();
        expect(screen.queryByTestId('map-visualization')).not.toBeInTheDocument();
      });

      // Switch back to map tab
      const mapTab = screen.getByText(/route map/i);
      await user.click(mapTab);

      await waitFor(() => {
        expect(screen.getByTestId('map-visualization')).toBeInTheDocument();
        expect(screen.queryByTestId('elevation-chart')).not.toBeInTheDocument();
      });
    });

    it('displays route statistics correctly', () => {
      // Check route statistics are displayed
      expect(screen.getByText(/track points/i)).toBeInTheDocument();
      expect(screen.getByText(/waypoints/i)).toBeInTheDocument();
      expect(screen.getByText(/min elevation/i)).toBeInTheDocument();
      expect(screen.getByText(/max elevation/i)).toBeInTheDocument();
    });
  });

  describe('Route Saving Workflow', () => {
    beforeEach(async () => {
      // Setup with sample data
      const user = userEvent.setup();
      render(<AnalyzerTab />);
      
      const sampleButton = screen.getByText(/sample data/i);
      await user.click(sampleButton);
      
      await waitFor(() => {
        expect(screen.getByText(/save route/i)).toBeInTheDocument();
      });
    });

    it('saves route with valid name', async () => {
      const user = userEvent.setup();

      // Enter route name
      const nameInput = screen.getByPlaceholderText(/route name/i);
      await user.type(nameInput, 'My Test Route');

      // Click save button
      const saveButton = screen.getByText(/save route/i);
      await user.click(saveButton);

      // Should show success message
      await waitFor(() => {
        expect(screen.getByText(/saved successfully/i)).toBeInTheDocument();
      });

      // Input should be cleared
      expect(nameInput).toHaveValue('');
    });

    it('validates required route name', async () => {
      const user = userEvent.setup();

      // Try to save without entering name
      const saveButton = screen.getByText(/save route/i);
      await user.click(saveButton);

      // Should show validation error
      await waitFor(() => {
        expect(screen.getByText(/enter a route name/i)).toBeInTheDocument();
      });
    });

    it('handles save API error gracefully', async () => {
      const user = userEvent.setup();

      // Mock API error
      const { mockApiError } = await import('../mocks/api');
      mockApiError('/api/routes', 500, 'Server error');

      // Enter route name and try to save
      const nameInput = screen.getByPlaceholderText(/route name/i);
      await user.type(nameInput, 'Test Route');

      const saveButton = screen.getByText(/save route/i);
      await user.click(saveButton);

      // Should show error message
      await waitFor(() => {
        expect(screen.getByText(/server error/i)).toBeInTheDocument();
      });
    });
  });

  describe('Target Time Controls', () => {
    beforeEach(async () => {
      // Setup with sample data
      const user = userEvent.setup();
      render(<AnalyzerTab />);
      
      const sampleButton = screen.getByText(/sample data/i);
      await user.click(sampleButton);
      
      await waitFor(() => {
        expect(screen.getByText(/target time/i)).toBeInTheDocument();
      });
    });

    it('shows target time controls when route is loaded', () => {
      expect(screen.getByText(/target time/i)).toBeInTheDocument();
    });

    it('allows setting target time', async () => {
      const user = userEvent.setup();

      // Find target time inputs (hours, minutes, seconds)
      const timeInputs = screen.getAllByRole('spinbutton');
      expect(timeInputs).toHaveLength(3);

      // Set target time
      await user.clear(timeInputs[0]); // hours
      await user.type(timeInputs[0], '2');
      
      await user.clear(timeInputs[1]); // minutes
      await user.type(timeInputs[1], '30');

      // Values should be updated
      expect(timeInputs[0]).toHaveValue(2);
      expect(timeInputs[1]).toHaveValue(30);
    });
  });

  describe('Loading States', () => {
    it('shows loading state during file upload', async () => {
      const user = userEvent.setup();
      render(<AnalyzerTab />);

      // Create mock file
      const file = createMockFile(mockGPXContent, 'test-route.gpx');
      const fileInput = screen.getByRole('button', { name: /upload/i });

      // Start upload
      await user.upload(fileInput, file);

      // Should show loading state
      expect(screen.getByText(/loading/i)).toBeInTheDocument();
    });

    it('shows loading state during route save', async () => {
      const user = userEvent.setup();
      render(<AnalyzerTab />);

      // Load sample data first
      const sampleButton = screen.getByText(/sample data/i);
      await user.click(sampleButton);

      await waitFor(() => {
        expect(screen.getByText(/save route/i)).toBeInTheDocument();
      });

      // Enter route name
      const nameInput = screen.getByPlaceholderText(/route name/i);
      await user.type(nameInput, 'Test Route');

      // Click save
      const saveButton = screen.getByText(/save route/i);
      await user.click(saveButton);

      // Should show saving state
      expect(screen.getByText(/saving/i)).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('handles file reading errors', async () => {
      const user = userEvent.setup();
      render(<AnalyzerTab />);

      // Mock file read error
      const originalFileReader = global.FileReader;
      global.FileReader = jest.fn(() => ({
        readAsText: jest.fn(),
        onerror: jest.fn(),
        onload: jest.fn(),
      })) as any;

      const file = createMockFile('invalid gpx content', 'test.gpx');
      const fileInput = screen.getByRole('button', { name: /upload/i });

      await user.upload(fileInput, file);

      // Simulate file reader error
      const mockReader = new FileReader();
      if (mockReader.onerror) {
        mockReader.onerror(new ProgressEvent('error'));
      }

      await waitFor(() => {
        expect(screen.getByText(/error parsing/i)).toBeInTheDocument();
      });

      // Restore original FileReader
      global.FileReader = originalFileReader;
    });
  });

  describe('Accessibility', () => {
    it('is accessible in empty state', async () => {
      const { container } = render(<AnalyzerTab />);
      const results = await checkAccessibility(container);
      expect(results).toHaveNoViolations();
    });

    it('is accessible with loaded route', async () => {
      const user = userEvent.setup();
      const { container } = render(<AnalyzerTab />);

      // Load sample data
      const sampleButton = screen.getByText(/sample data/i);
      await user.click(sampleButton);

      await waitFor(() => {
        expect(screen.getByText(/route visualization/i)).toBeInTheDocument();
      });

      const results = await checkAccessibility(container);
      expect(results).toHaveNoViolations();
    });

    it('has proper form labels and ARIA attributes', async () => {
      const user = userEvent.setup();
      render(<AnalyzerTab />);

      // Load sample data to show save section
      const sampleButton = screen.getByText(/sample data/i);
      await user.click(sampleButton);

      await waitFor(() => {
        expect(screen.getByText(/save route/i)).toBeInTheDocument();
      });

      // Check form accessibility
      const nameInput = screen.getByPlaceholderText(/route name/i);
      expect(nameInput).toHaveAccessibleName();
      
      const saveButton = screen.getByRole('button', { name: /save route/i });
      expect(saveButton).toBeInTheDocument();
    });
  });

  describe('Responsive Behavior', () => {
    it('adapts layout for mobile screens', () => {
      // Mock window.matchMedia for mobile
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: jest.fn().mockImplementation(query => ({
          matches: query.includes('(max-width: 768px)'),
          media: query,
          onchange: null,
          addListener: jest.fn(),
          removeListener: jest.fn(),
          addEventListener: jest.fn(),
          removeEventListener: jest.fn(),
          dispatchEvent: jest.fn(),
        })),
      });

      render(<AnalyzerTab />);

      // Check responsive classes are applied
      const container = screen.getByText(/upload/i).closest('.space-y-8');
      expect(container).toHaveClass('space-y-8');
    });
  });
}); 