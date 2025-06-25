import React from 'react';

const AppLogoIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    viewBox="0 0 24 24" 
    fill="currentColor"
    {...props}
  >
    {/* Simple dumbbell shape */}
    <rect x="2" y="9" width="4" height="6" rx="1" /> 
    <rect x="18" y="9" width="4" height="6" rx="1" />
    <rect x="5" y="11" width="14" height="2" rx="0.5" />
  </svg>
);

export default AppLogoIcon;