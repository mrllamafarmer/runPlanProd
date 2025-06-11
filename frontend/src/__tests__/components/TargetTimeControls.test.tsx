import React from 'react';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render, setupMockStore, checkAccessibility } from '../utils/test-utils';
import TargetTimeControls from '../../components/TargetTimeControls';

// Mock the store
jest.mock('../../store/useAppStore', () => ({
  useAppStore: jest.fn(),
}));

describe('TargetTimeControls', () => {
  const mockSetTargetTime = jest.fn();
  const mockSetSlowdownFactor = jest.fn();
  
  const defaultProps = {
    targetTimeSeconds: 0,
    slowdownFactorPercent: 0,
    totalDistanceMiles: 10.5,
    totalElevationGain: 1500,
    isVisible: true,
    onTargetTimeChange: mockSetTargetTime,
    onSlowdownFactorChange: mockSetSlowdownFactor,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    setupMockStore();
  });

  describe('Rendering', () => {
    it('renders all main sections when visible', () => {
      render(<TargetTimeControls {...defaultProps} />);
      
      expect(screen.getByText('Target Time & Pacing')).toBeInTheDocument();
      expect(screen.getByText('Route Statistics')).toBeInTheDocument();
      expect(screen.getByText('Target Time')).toBeInTheDocument();
      expect(screen.getByText('Pace Calculation')).toBeInTheDocument();
    });

    it('does not render when not visible', () => {
      render(<TargetTimeControls {...defaultProps} isVisible={false} />);
      
      expect(screen.queryByText('Target Time & Pacing')).not.toBeInTheDocument();
    });

    it('displays route statistics correctly', () => {
      render(<TargetTimeControls {...defaultProps} />);
      
      expect(screen.getByText('10.5 miles')).toBeInTheDocument();
      expect(screen.getByText('1,500 ft')).toBeInTheDocument();
    });
  });

  describe('Target Time Input', () => {
    it('allows input in HH:MM:SS format', async () => {
      const user = userEvent.setup();
      render(<TargetTimeControls {...defaultProps} />);
      
      const timeInput = screen.getByLabelText(/target time/i);
      await user.clear(timeInput);
      await user.type(timeInput, '02:30:00');
      
      await waitFor(() => {
        expect(mockSetTargetTime).toHaveBeenCalledWith(9000); // 2.5 hours in seconds
      });
    });

    it('handles multiday time input (>24 hours)', async () => {
      const user = userEvent.setup();
      render(<TargetTimeControls {...defaultProps} />);
      
      const timeInput = screen.getByLabelText(/target time/i);
      await user.clear(timeInput);
      await user.type(timeInput, '30:00:00');
      
      await waitFor(() => {
        expect(mockSetTargetTime).toHaveBeenCalledWith(108000); // 30 hours in seconds
      });
    });

    it('shows validation error for invalid time format', async () => {
      const user = userEvent.setup();
      render(<TargetTimeControls {...defaultProps} />);
      
      const timeInput = screen.getByLabelText(/target time/i);
      await user.clear(timeInput);
      await user.type(timeInput, 'invalid');
      
      await waitFor(() => {
        expect(screen.getByText(/invalid time format/i)).toBeInTheDocument();
      });
    });

    it('displays current target time correctly', () => {
      render(<TargetTimeControls {...defaultProps} targetTimeSeconds={9000} />);
      
      const timeInput = screen.getByDisplayValue('02:30:00');
      expect(timeInput).toBeInTheDocument();
    });
  });

  describe('Slowdown Factor', () => {
    it('allows setting slowdown factor', async () => {
      const user = userEvent.setup();
      render(<TargetTimeControls {...defaultProps} />);
      
      const slowdownInput = screen.getByLabelText(/slowdown factor/i);
      await user.clear(slowdownInput);
      await user.type(slowdownInput, '10');
      
      await waitFor(() => {
        expect(mockSetSlowdownFactor).toHaveBeenCalledWith(10);
      });
    });

    it('validates slowdown factor range', async () => {
      const user = userEvent.setup();
      render(<TargetTimeControls {...defaultProps} />);
      
      const slowdownInput = screen.getByLabelText(/slowdown factor/i);
      await user.clear(slowdownInput);
      await user.type(slowdownInput, '150');
      
      await waitFor(() => {
        expect(screen.getByText(/must be between/i)).toBeInTheDocument();
      });
    });
  });

  describe('Pace Calculations', () => {
    it('displays overall pace when target time is set', () => {
      render(<TargetTimeControls {...defaultProps} targetTimeSeconds={9000} />);
      
      // Overall pace = 9000 seconds / 10.5 miles = 857 seconds per mile = 14:17 pace
      expect(screen.getByText(/14:17/)).toBeInTheDocument();
    });

    it('displays moving pace separate from overall pace', () => {
      render(<TargetTimeControls {...defaultProps} targetTimeSeconds={9000} />);
      
      expect(screen.getByText('Overall Pace')).toBeInTheDocument();
      expect(screen.getByText('Moving Pace')).toBeInTheDocument();
    });

    it('shows placeholder when no target time set', () => {
      render(<TargetTimeControls {...defaultProps} targetTimeSeconds={0} />);
      
      expect(screen.getByText('--:--')).toBeInTheDocument();
    });
  });

  describe('Time Breakdown', () => {
    it('shows time breakdown when target time is set', () => {
      render(<TargetTimeControls {...defaultProps} targetTimeSeconds={9000} />);
      
      expect(screen.getByText('Time Breakdown')).toBeInTheDocument();
      expect(screen.getByText('Total Time')).toBeInTheDocument();
      expect(screen.getByText('Moving Time')).toBeInTheDocument();
    });

    it('displays helpful tips', () => {
      render(<TargetTimeControls {...defaultProps} />);
      
      expect(screen.getByText(/helpful tips/i)).toBeInTheDocument();
    });
  });

  describe('Elevation Adjustment', () => {
    it('shows elevation-adjusted pacing when enabled', () => {
      render(<TargetTimeControls {...defaultProps} targetTimeSeconds={9000} />);
      
      expect(screen.getByText(/elevation.*adjust/i)).toBeInTheDocument();
    });

    it('explains elevation impact on pacing', () => {
      render(<TargetTimeControls {...defaultProps} totalElevationGain={2000} />);
      
      expect(screen.getByText(/elevation.*impact/i)).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('is accessible', async () => {
      const { container } = render(<TargetTimeControls {...defaultProps} />);
      
      const results = await checkAccessibility(container);
      expect(results).toHaveNoViolations();
    });

    it('has proper form labels', () => {
      render(<TargetTimeControls {...defaultProps} />);
      
      expect(screen.getByLabelText(/target time/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/slowdown factor/i)).toBeInTheDocument();
    });

    it('supports keyboard navigation', async () => {
      const user = userEvent.setup();
      render(<TargetTimeControls {...defaultProps} />);
      
      const timeInput = screen.getByLabelText(/target time/i);
      const slowdownInput = screen.getByLabelText(/slowdown factor/i);
      
      await user.tab();
      expect(timeInput).toHaveFocus();
      
      await user.tab();
      expect(slowdownInput).toHaveFocus();
    });
  });

  describe('Edge Cases', () => {
    it('handles zero distance gracefully', () => {
      render(<TargetTimeControls {...defaultProps} totalDistanceMiles={0} />);
      
      expect(screen.getByText('0 miles')).toBeInTheDocument();
    });

    it('handles very long distances', () => {
      render(<TargetTimeControls {...defaultProps} totalDistanceMiles={100.5} />);
      
      expect(screen.getByText('100.5 miles')).toBeInTheDocument();
    });

    it('handles very high elevation gain', () => {
      render(<TargetTimeControls {...defaultProps} totalElevationGain={10000} />);
      
      expect(screen.getByText('10,000 ft')).toBeInTheDocument();
    });
  });

  describe('Real-time Updates', () => {
    it('updates pace calculation when distance changes', () => {
      const { rerender } = render(<TargetTimeControls {...defaultProps} targetTimeSeconds={3600} />);
      
      // Initially 10.5 miles = 3600/10.5 = 342 seconds per mile = 5:42 pace
      expect(screen.getByText(/5:42/)).toBeInTheDocument();
      
      // Update distance
      rerender(<TargetTimeControls {...defaultProps} targetTimeSeconds={3600} totalDistanceMiles={6} />);
      
      // Now 6 miles = 3600/6 = 600 seconds per mile = 10:00 pace
      expect(screen.getByText(/10:00/)).toBeInTheDocument();
    });

    it('updates when target time changes externally', () => {
      const { rerender } = render(<TargetTimeControls {...defaultProps} targetTimeSeconds={3600} />);
      
      expect(screen.getByDisplayValue('01:00:00')).toBeInTheDocument();
      
      rerender(<TargetTimeControls {...defaultProps} targetTimeSeconds={7200} />);
      
      expect(screen.getByDisplayValue('02:00:00')).toBeInTheDocument();
    });
  });
}); 