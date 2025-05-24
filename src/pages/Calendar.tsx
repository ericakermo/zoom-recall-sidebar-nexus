
import React, { useState } from 'react';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';

const Calendar = () => {
  const [date, setDate] = useState<Date | undefined>(new Date());

  return (
    <div className="p-6 h-full">
      <h1 className="text-3xl font-bold mb-6">Calendar</h1>
      <div className="flex items-start gap-6 h-full">
        {/* Calendar on the left */}
        <div className="flex-shrink-0">
          <CalendarComponent
            mode="single"
            selected={date}
            onSelect={setDate}
            className="rounded-lg border border-border p-3 pointer-events-auto"
          />
        </div>
        
        {/* Horizontal line on the right */}
        <div className="flex-1 flex items-center">
          <div className="w-full h-px bg-black opacity-20"></div>
        </div>
      </div>
    </div>
  );
};

export default Calendar;
