
import React from 'react';

const Calendar = () => {
  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">Calendar</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((item) => (
          <div 
            key={item}
            className="h-24 rounded-lg bg-gray-100 dark:bg-neutral-800 animate-pulse"
          ></div>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
        {[1, 2].map((item) => (
          <div 
            key={item}
            className="h-64 rounded-lg bg-gray-100 dark:bg-neutral-800 animate-pulse"
          ></div>
        ))}
      </div>
      <div className="mt-6 p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
        <h2 className="text-xl font-semibold mb-2">Ready for Integration</h2>
        <p className="text-gray-600 dark:text-gray-300">
          This clean layout is ready for calendar functionality. The sidebar provides easy navigation between features.
        </p>
      </div>
    </div>
  );
};

export default Calendar;
