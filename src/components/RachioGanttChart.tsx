import React, { useMemo, useState } from 'react';
import { format } from 'date-fns';

const ZONE_COLORS = [
  'bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-lime-500',
  'bg-emerald-500', 'bg-cyan-500', 'bg-blue-500', 'bg-violet-500',
  'bg-fuchsia-500', 'bg-rose-500'
];

export default function RachioGanttChart({ 
  events, 
  zones, 
  viewMode = 'date' 
}: { 
  events: any[], 
  zones: any[],
  viewMode?: 'date' | 'zone'
}) {
  const [hoveredEvent, setHoveredEvent] = useState<any | null>(null);
  const [hoveredDay, setHoveredDay] = useState<any | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  const handleMouseMoveEvent = (e: React.MouseEvent, eventData: any) => {
    e.stopPropagation();
    setHoveredDay(null);
    setHoveredEvent(eventData);
    setTooltipPos({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMoveDay = (e: React.MouseEvent, dayData: any) => {
    setHoveredEvent(null);
    setHoveredDay(dayData);
    setTooltipPos({ x: e.clientX, y: e.clientY });
  };

  const handleMouseLeave = () => {
    setHoveredEvent(null);
    setHoveredDay(null);
  };

  const chartData = useMemo(() => {
    const allEvents = [...(events || [])];

    if (allEvents.length === 0) return { data: [], zoneColorMap: {} };

    const wateringEvents = allEvents.filter(e => 
      e.type === 'WATERING' || 
      e.summary?.toLowerCase().includes('watering') || 
      e.summary?.toLowerCase().includes('watered') ||
      e.summary?.toLowerCase().includes('scheduled')
    );

    const zoneColorMap: Record<string, string> = {};
    zones.forEach((z, i) => {
      zoneColorMap[z.name] = ZONE_COLORS[i % ZONE_COLORS.length];
    });
    let colorIndex = zones.length;

    const processedEvents: any[] = [];

    wateringEvents.forEach(event => {
      let durationMinutes = event.durationMinutes || 8;
      if (!event.durationMinutes) {
        const match = event.summary?.match(/(\d+)\s*minute/i);
        if (match && match[1]) {
          durationMinutes = parseInt(match[1], 10);
        }
      }

      const durationHours = durationMinutes / 60;
      
      let rawZoneName = event.zoneName || event.topic;
      let extractedZoneName = '';

      let isCompletion = false;
      if (event.summary) {
        const summaryMatch = event.summary.match(/^(.*?)\s+(watered|started|completed|scheduled)/i);
        if (summaryMatch && summaryMatch[1]) {
          extractedZoneName = summaryMatch[1].trim();
          const action = summaryMatch[2].toLowerCase();
          if (action === 'completed' || action === 'watered') {
            isCompletion = true;
          }
        }
      }

      let eventDate = new Date(event.eventDate);
      if (isCompletion) {
        eventDate = new Date(eventDate.getTime() - durationMinutes * 60000);
      }
      
      const date = eventDate;
      const hourOfDay = date.getHours() + date.getMinutes() / 60;

      let bestName = rawZoneName && rawZoneName.toUpperCase() !== 'WATERING' ? rawZoneName : extractedZoneName;
      bestName = bestName ? bestName.replace(/\.{3}$/, '').trim() : '';

      let finalZoneName = '';
      
      if (bestName) {
        const bestNameLower = bestName.toLowerCase();
        const matchedZone = zones.find(z => {
          const zNameLower = z.name.toLowerCase();
          return zNameLower === bestNameLower || 
                 zNameLower.startsWith(bestNameLower) || 
                 bestNameLower.startsWith(zNameLower);
        });
        
        if (matchedZone) {
          finalZoneName = matchedZone.name;
        } else {
          finalZoneName = bestName;
        }
      } 
      
      if (!finalZoneName && event.summary) {
        const matchedZone = zones.find(z => event.summary.toLowerCase().includes(z.name.toLowerCase().replace(/\.{3}$/, '')));
        if (matchedZone) {
          finalZoneName = matchedZone.name;
        }
      }

      if (!finalZoneName || finalZoneName.toUpperCase() === 'WATERING' || finalZoneName.toUpperCase() === 'SCHEDULE') {
        return;
      }
      
      if (finalZoneName === 'Phantom Zone') {
        return;
      }

      if (!zoneColorMap[finalZoneName]) {
        zoneColorMap[finalZoneName] = ZONE_COLORS[colorIndex % ZONE_COLORS.length];
        colorIndex++;
      }

      processedEvents.push({
        time: hourOfDay,
        duration: durationHours,
        summary: event.summary,
        zoneName: finalZoneName,
        date: date,
        type: event.type,
        colorClass: zoneColorMap[finalZoneName]
      });
    });

    if (viewMode === 'date') {
      const daysMap: Record<string, any[]> = {};
      processedEvents.forEach(e => {
        const dayKey = format(e.date, 'MMM do');
        if (!daysMap[dayKey]) daysMap[dayKey] = [];
        
        // Deduplicate
        const exists = daysMap[dayKey].find(ex => 
          ex.zoneName === e.zoneName && 
          Math.abs(ex.date.getTime() - e.date.getTime()) < 2 * 60000
        );
        if (!exists) daysMap[dayKey].push(e);
      });

      const data = Object.keys(daysMap).map(day => ({
        label: day,
        events: daysMap[day],
        sortDate: daysMap[day][0].date
      }));

      data.sort((a, b) => a.sortDate.getTime() - b.sortDate.getTime());
      return { data, zoneColorMap };
    } else {
      // Zone-wise view
      const zonesMap: Record<string, any[]> = {};
      processedEvents.forEach(e => {
        if (!zonesMap[e.zoneName]) zonesMap[e.zoneName] = [];
        
        // Deduplicate
        const exists = zonesMap[e.zoneName].find(ex => 
          Math.abs(ex.date.getTime() - e.date.getTime()) < 2 * 60000
        );
        if (!exists) zonesMap[e.zoneName].push(e);
      });

      const data = Object.keys(zonesMap).map(zoneName => ({
        label: zoneName,
        events: zonesMap[zoneName],
        colorClass: zoneColorMap[zoneName]
      }));

      // Sort zones by name
      data.sort((a, b) => a.label.localeCompare(b.label));
      return { data, zoneColorMap };
    }
  }, [events, zones, viewMode]);

  if (!events || events.length === 0 || chartData.data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-slate-500 italic">
        No Rachio events found.
      </div>
    );
  }

  const { data, zoneColorMap } = chartData;

  // Determine X-Axis range for zone view (approx 30 days)
  const now = new Date();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(now.getDate() - 30);
  const totalTimeRange = now.getTime() - thirtyDaysAgo.getTime();

  return (
    <div className="space-y-6">
      {/* Legend */}
      <div className="flex flex-wrap gap-4 mb-2">
        {Object.entries(zoneColorMap).map(([zone, colorClass]) => (
          <div key={zone} className="flex items-center gap-2 text-sm">
            <div className={`w-3 h-3 rounded-full ${colorClass}`}></div>
            <span>{zone}</span>
          </div>
        ))}
      </div>

      {/* Gantt Chart */}
      <div className="relative border-l border-b border-slate-200 pb-2 mt-4">
        {/* X-Axis ticks */}
        <div className="absolute top-0 bottom-0 left-32 right-0 pointer-events-none">
          {viewMode === 'date' ? (
            [0, 4, 8, 12, 16, 20, 24].map(hour => (
              <div 
                key={hour} 
                className="absolute top-0 bottom-0 border-l border-slate-100 border-dashed"
                style={{ left: `${(hour / 24) * 100}%` }}
              >
                <span className="absolute -bottom-6 -translate-x-1/2 text-xs text-slate-400">
                  {hour}:00
                </span>
              </div>
            ))
          ) : (
            // For zone view, show weekly ticks
            [0, 7, 14, 21, 28].map(dayOffset => {
              const tickDate = new Date(thirtyDaysAgo.getTime() + dayOffset * 24 * 60 * 60 * 1000);
              const leftPercent = (dayOffset / 30) * 100;
              return (
                <div 
                  key={dayOffset} 
                  className="absolute top-0 bottom-0 border-l border-slate-100 border-dashed"
                  style={{ left: `${leftPercent}%` }}
                >
                  <span className="absolute -bottom-6 -translate-x-1/2 text-xs text-slate-400">
                    {format(tickDate, 'MMM d')}
                  </span>
                </div>
              );
            })
          )}
        </div>

        <div className="space-y-4 relative z-10 pt-2" onMouseLeave={handleMouseLeave}>
          {data.map((row, i) => {
            const totalDurationHours = row.events.reduce((acc: number, e: any) => acc + e.duration, 0);
            return (
              <div 
                key={i} 
                className="flex items-center group cursor-pointer"
                onMouseMove={(evt) => handleMouseMoveDay(evt, { label: row.label, totalDuration: totalDurationHours, eventCount: row.events.length })}
              >
                <div className="w-32 text-xs text-slate-600 font-medium shrink-0 text-right pr-4 group-hover:text-slate-900 transition-colors break-words">
                  {row.label}
                </div>
                <div className="flex-1 h-8 relative bg-slate-50 rounded-md overflow-hidden border border-slate-100 group-hover:border-slate-300 transition-colors">
                  {row.events.map((e: any, j: number) => {
                    let leftPercent, widthPercent;
                    
                    if (viewMode === 'date') {
                      leftPercent = (e.time / 24) * 100;
                      widthPercent = Math.max((e.duration / 24) * 100, 0.5);
                    } else {
                      // Zone view: X-axis is time over 30 days
                      const timeFromStart = e.date.getTime() - thirtyDaysAgo.getTime();
                      leftPercent = (timeFromStart / totalTimeRange) * 100;
                      widthPercent = Math.max((e.duration / (30 * 24)) * 100, 0.2);
                    }

                    return (
                      <div
                        key={j}
                        className={`absolute top-0 bottom-0 ${e.colorClass} opacity-90 hover:opacity-100 transition-opacity cursor-pointer border-r border-white/50`}
                        style={{ left: `${leftPercent}%`, width: `${widthPercent}%` }}
                        onMouseMove={(evt) => handleMouseMoveEvent(evt, e)}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="h-6"></div> {/* Spacer for x-axis labels */}
      <p className="text-sm text-slate-500 text-center mt-4">
        {viewMode === 'date' 
          ? "Hover over the colored blocks to see the exact times and zones that watered."
          : "View all watering events for each zone over the past 30 days."}
      </p>

      {/* Tooltip */}
      {(hoveredEvent || hoveredDay) && (
        <div 
          className="fixed z-50 bg-slate-900 text-white text-sm px-3 py-2 rounded shadow-lg pointer-events-none transform -translate-x-1/2 -translate-y-full mt-[-10px]"
          style={{ left: tooltipPos.x, top: tooltipPos.y }}
        >
          {hoveredEvent ? (
            <>
              <div className="font-semibold mb-1 flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${hoveredEvent.colorClass}`}></div>
                {hoveredEvent.zoneName}
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2 text-slate-200">
                <div className="text-slate-400">Date:</div>
                <div>{format(hoveredEvent.date, 'MMM do')}</div>
                <div className="text-slate-400">Time:</div>
                <div>{format(hoveredEvent.date, 'h:mm a')}</div>
                <div className="text-slate-400">Duration:</div>
                <div>{Math.round(hoveredEvent.duration * 60)} min</div>
              </div>
              <div className="text-slate-400 text-xs mt-2 italic border-t border-slate-700 pt-2">
                {hoveredEvent.summary}
              </div>
            </>
          ) : (
            <>
              <div className="font-semibold mb-1">{hoveredDay.label} Summary</div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2 text-slate-200">
                <div className="text-slate-400">Total Runs:</div>
                <div>{hoveredDay.eventCount}</div>
                <div className="text-slate-400">Total Time:</div>
                <div>{Math.round(hoveredDay.totalDuration * 60)} min</div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
