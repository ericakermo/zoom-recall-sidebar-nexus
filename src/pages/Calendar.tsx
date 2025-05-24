
"use client";

import React, { useState } from 'react';
import { Calendar } from "@/components/ui/calendar-rac";
import { getLocalTimeZone, today } from "@internationalized/date";
import type { DateValue } from "react-aria-components";
import { Separator } from "@/components/ui/separator";

const CalendarPage = () => {
  const [date, setDate] = useState<DateValue | null>(today(getLocalTimeZone()));

  return (
    <div className="flex items-start gap-6 p-6">
      {/* Left side - Calendar component */}
      <div className="flex-shrink-0">
        <Calendar 
          className="rounded-lg border border-border p-2" 
          value={date} 
          onChange={setDate} 
        />
      </div>
      
      {/* Horizontal separator line */}
      <Separator 
        orientation="vertical" 
        className="h-80 bg-black opacity-20" 
      />
      
      {/* Right side - Rest of the content */}
      <div className="flex-1">
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
    </div>
  );
};

export default CalendarPage;
