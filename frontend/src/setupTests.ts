// jest-dom adds custom jest matchers for asserting on DOM nodes.
import '@testing-library/jest-dom';
import 'jest-axe/extend-expect';
import 'jest-canvas-mock';
import ResizeObserver from 'resize-observer-polyfill';

// Mock ResizeObserver for components that use it (like charts)
global.ResizeObserver = ResizeObserver;

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // deprecated
    removeListener: jest.fn(), // deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock URL.createObjectURL for file handling tests
global.URL.createObjectURL = jest.fn(() => 'mock-url');
global.URL.revokeObjectURL = jest.fn();

// Mock Leaflet for map testing
jest.mock('leaflet', () => ({
  map: jest.fn(() => ({
    setView: jest.fn(),
    addLayer: jest.fn(),
    removeLayer: jest.fn(),
    fitBounds: jest.fn(),
    remove: jest.fn(),
  })),
  tileLayer: jest.fn(() => ({
    addTo: jest.fn(),
  })),
  marker: jest.fn(() => ({
    addTo: jest.fn(),
    bindPopup: jest.fn().mockReturnThis(),
    setLatLng: jest.fn(),
    remove: jest.fn(),
  })),
  polyline: jest.fn(() => ({
    addTo: jest.fn(),
    setLatLngs: jest.fn(),
    remove: jest.fn(),
  })),
  layerGroup: jest.fn(() => ({
    addTo: jest.fn().mockReturnThis(),
    addLayer: jest.fn(),
    removeLayer: jest.fn(),
    remove: jest.fn(),
  })),
  latLngBounds: jest.fn(() => ({
    extend: jest.fn(),
    isValid: jest.fn(() => true),
  })),
  divIcon: jest.fn(() => ({})),
  Icon: {
    Default: {
      prototype: {
        _getIconUrl: jest.fn(),
      },
      mergeOptions: jest.fn(),
    },
  },
}));

// Mock Chart.js for chart testing
jest.mock('chart.js', () => ({
  Chart: {
    register: jest.fn(),
  },
  CategoryScale: jest.fn(),
  LinearScale: jest.fn(),
  PointElement: jest.fn(),
  LineElement: jest.fn(),
  Title: jest.fn(),
  Tooltip: jest.fn(),
  Legend: jest.fn(),
  Filler: jest.fn(),
}));

// Mock react-chartjs-2
jest.mock('react-chartjs-2', () => ({
  Line: jest.fn(() => {
    const MockCanvas = () => {
      const mockCanvas = {
        getContext: jest.fn(() => ({
          fillRect: jest.fn(),
          clearRect: jest.fn(),
          getImageData: jest.fn(),
          putImageData: jest.fn(),
          createImageData: jest.fn(),
          setTransform: jest.fn(),
          drawImage: jest.fn(),
          save: jest.fn(),
          restore: jest.fn(),
          beginPath: jest.fn(),
          moveTo: jest.fn(),
          lineTo: jest.fn(),
          closePath: jest.fn(),
          stroke: jest.fn(),
          fill: jest.fn(),
        })),
        width: 500,
        height: 500,
      };
      return mockCanvas;
    };
    MockCanvas.setAttribute = jest.fn();
    return MockCanvas;
  }),
}));

// Suppress console warnings during tests unless explicitly testing them
const originalError = console.error;
const originalWarn = console.warn;

beforeAll(() => {
  console.error = (...args) => {
    if (
      typeof args[0] === 'string' &&
      args[0].includes('Warning: ReactDOM.render is deprecated')
    ) {
      return;
    }
    originalError.call(console, ...args);
  };
  
  console.warn = (...args) => {
    if (
      typeof args[0] === 'string' &&
      (args[0].includes('componentWillMount') || args[0].includes('componentWillReceiveProps'))
    ) {
      return;
    }
    originalWarn.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
  console.warn = originalWarn;
}); 