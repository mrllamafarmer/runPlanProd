import { create } from 'zustand';
import { AppState, TrackPoint, Waypoint, CustomLeg, RouteData, FileInfo, RouteListItem, Toast, WaypointDB } from '../types';

interface AppStore extends AppState {
  // Actions for route data
  setCurrentRoute: (route: RouteData | null) => void;
  updateCurrentRoute: (updates: Partial<RouteData>) => void;
  setTrackPoints: (points: TrackPoint[]) => void;
  setWaypoints: (waypoints: Waypoint[]) => void;
  addCustomLeg: (leg: CustomLeg) => void;
  removeCustomLeg: (distance: number) => void;
  updateCustomLeg: (distance: number, updates: Partial<CustomLeg>) => void;
  
  // Enhanced waypoint management
  currentRouteId: string | null;
  setCurrentRouteId: (routeId: string | null) => void;
  routeWaypoints: WaypointDB[];
  setRouteWaypoints: (waypoints: WaypointDB[]) => void;
  addRouteWaypoint: (waypoint: WaypointDB) => void;
  updateRouteWaypoint: (waypointId: number, updates: Partial<WaypointDB>) => void;
  removeRouteWaypoint: (waypointId: number) => void;
  isWaypointCreationMode: boolean;
  setWaypointCreationMode: (enabled: boolean) => void;
  
  // Actions for route settings
  setTargetTime: (seconds: number | null) => void;
  setSlowdownFactor: (percent: number) => void;
  setHasValidTime: (hasTime: boolean) => void;
  setUsingTargetTime: (usingTarget: boolean) => void;
  
  // Actions for UI state
  setActiveTab: (tab: 'analyzer' | 'saved-routes') => void;
  setActiveVizTab: (tab: 'map' | 'elevation') => void;
  setLoading: (loading: boolean) => void;
  
  // Actions for file info
  setFileInfo: (info: FileInfo | null) => void;
  
  // Actions for saved routes
  setSavedRoutes: (routes: RouteListItem[]) => void;
  addSavedRoute: (route: RouteListItem) => void;
  removeSavedRoute: (routeId: string) => void;
  
  // Actions for toasts
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
  clearToasts: () => void;
  
  // Reset state
  resetState: () => void;
}

const initialState: AppState = {
  currentRoute: null,
  trackPoints: [],
  waypoints: [],
  customLegs: [],
  
  // Enhanced waypoint management
  currentRouteId: null,
  routeWaypoints: [],
  isWaypointCreationMode: false,
  
  targetTimeSeconds: null,
  slowdownFactorPercent: 0,
  hasValidTime: false,
  usingTargetTime: false,
  activeTab: 'analyzer',
  activeVizTab: 'map',
  isLoading: false,
  fileInfo: null,
  savedRoutes: [],
  toasts: [],
};

export const useAppStore = create<AppStore>((set, get) => ({
  ...initialState,
  
  // Route data actions
  setCurrentRoute: (route) => set({ currentRoute: route }),
  updateCurrentRoute: (updates) => set((state) => ({
    currentRoute: state.currentRoute ? { ...state.currentRoute, ...updates } : null
  })),
  setTrackPoints: (points) => set({ trackPoints: points }),
  setWaypoints: (waypoints) => set({ waypoints }),
  
  addCustomLeg: (leg) => set((state) => ({
    customLegs: [...state.customLegs, leg].sort((a, b) => a.distance - b.distance)
  })),
  
  removeCustomLeg: (distance) => set((state) => ({
    customLegs: state.customLegs.filter(leg => leg.distance !== distance)
  })),
  
  updateCustomLeg: (distance, updates) => set((state) => ({
    customLegs: state.customLegs.map(leg => 
      leg.distance === distance ? { ...leg, ...updates } : leg
    )
  })),
  
  // Enhanced waypoint management actions
  setCurrentRouteId: (routeId) => set({ currentRouteId: routeId }),
  
  setRouteWaypoints: (waypoints) => set({ routeWaypoints: waypoints }),
  
  addRouteWaypoint: (waypoint) => set((state) => ({
    routeWaypoints: [...state.routeWaypoints, waypoint].sort((a, b) => a.order_index - b.order_index)
  })),
  
  updateRouteWaypoint: (waypointId, updates) => set((state) => ({
    routeWaypoints: state.routeWaypoints.map(waypoint => 
      waypoint.id === waypointId ? { ...waypoint, ...updates } : waypoint
    )
  })),
  
  removeRouteWaypoint: (waypointId) => set((state) => ({
    routeWaypoints: state.routeWaypoints.filter(waypoint => waypoint.id !== waypointId)
  })),
  
  setWaypointCreationMode: (enabled) => set({ isWaypointCreationMode: enabled }),
  
  // Route settings actions
  setTargetTime: (seconds) => set({ targetTimeSeconds: seconds }),
  setSlowdownFactor: (percent) => set({ slowdownFactorPercent: percent }),
  setHasValidTime: (hasTime) => set({ hasValidTime: hasTime }),
  setUsingTargetTime: (usingTarget) => set({ usingTargetTime: usingTarget }),
  
  // UI state actions
  setActiveTab: (tab) => set({ activeTab: tab }),
  setActiveVizTab: (tab) => set({ activeVizTab: tab }),
  setLoading: (loading) => set({ isLoading: loading }),
  
  // File info actions
  setFileInfo: (info) => set({ fileInfo: info }),
  
  // Saved routes actions
  setSavedRoutes: (routes) => set({ savedRoutes: routes }),
  addSavedRoute: (route) => set((state) => ({
    savedRoutes: [route, ...state.savedRoutes]
  })),
  removeSavedRoute: (routeId) => set((state) => ({
    savedRoutes: state.savedRoutes.filter(route => route.id !== routeId)
  })),
  
  // Toast actions
  addToast: (toast) => set((state) => ({
    toasts: [...state.toasts, { ...toast, id: Date.now().toString() }]
  })),
  
  removeToast: (id) => set((state) => ({
    toasts: state.toasts.filter(toast => toast.id !== id)
  })),
  
  clearToasts: () => set({ toasts: [] }),
  
  // Reset state
  resetState: () => set(initialState),
})); 