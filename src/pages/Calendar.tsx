
import React, { useState } from 'react';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';

const Calendar = () => {
  const [date, setDate] = useState<Date | undefined>(new Date());
  
  return (
    <div className="p-6 h-full">
      <div className="flex items-start gap-6 h-full">
        {/* Calendar on the left */}
        <div className="flex-shrink-0">
          <CalendarComponent 
            mode="single" 
            selected={date} 
            onSelect={setDate} 
            className="rounded-lg border border-border p-3 pointer-events-auto [&_.day-selected]:bg-black [&_.day-selected]:text-white [&_.day-selected:hover]:bg-black [&_.day-selected:hover]:text-white" 
          />
        </div>
        
        {/* Vertical line on the right */}
        <div className="flex-1 flex justify-center">
          <div className="w-px h-full bg-black opacity-20"></div>
        </div>
      </div>
    </div>
  );
};

export default Calendar;
