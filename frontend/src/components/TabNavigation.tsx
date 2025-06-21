import { NavLink } from 'react-router-dom';

export default function TabNavigation() {
  return (
    <nav className="border-b border-gray-200">
      <div className="flex">
        <NavLink
          to="/analyzer"
          className={({ isActive }) =>
            `px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
              isActive
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`
          }
        >
          Analyzer
        </NavLink>
        <NavLink
          to="/saved-routes"
          className={({ isActive }) =>
            `px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
              isActive
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`
          }
        >
          Saved Routes
        </NavLink>
        <NavLink
          to="/race-analysis"
          className={({ isActive }) =>
            `px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
              isActive
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`
          }
        >
          Race Analysis
        </NavLink>
      </div>
    </nav>
  );
} 