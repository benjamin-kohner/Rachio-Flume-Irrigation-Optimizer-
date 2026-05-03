import React, { useState, useMemo } from 'react';
import { format, subDays, setHours, setMinutes, startOfDay } from 'date-fns';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Button } from '@/src/components/ui/button';
import { ArrowLeft } from 'lucide-react';

const ZONES = ['Zone 1', 'Zone 2', 'Zone 3', 'Zone 4', 'Zone 5', 'Zone 6'];
const CATEGORIES = ['Irrigation', 'Shower', 'Washing Machine', 'Toilet', 'Faucet'];

const COLORS: Record<string, string> = {
  'Irrigation': '#3b82f6', // blue-500
  'Shower': '#14b8a6', // teal-500
  'Washing Machine': '#f97316', // orange-500
  'Toilet': '#eab308', // yellow-500
  'Faucet': '#a855f7', // purple-500
  'Zone 1': '#ef4444', // red-500
  'Zone 2': '#f59e0b', // amber-500
  'Zone 3': '#84cc16', // lime-500
  'Zone 4': '#10b981', // emerald-500
  'Zone 5': '#06b6d4', // cyan-500
  'Zone 6': '#ec4899', // pink-500
};

// Mock Data Generators
const generateDailyData = () => {
  const data = [];
  for (let i = 6; i >= 0; i--) {
    const date = subDays(new Date(), i);
    data.push({
      date: format(date, 'MMM do'),
      fullDate: date,
      Irrigation: Math.floor(Math.random() * 200 + 100),
      Shower: Math.floor(Math.random() * 50 + 30),
      Toilet: Math.floor(Math.random() * 30 + 10),
      'Washing Machine': Math.floor(Math.random() * 40 + 10),
      Faucet: Math.floor(Math.random() * 20 + 5),
    });
  }
  return data;
};

const generateHourlyData = (date: Date) => {
  const data = [];
  for (let i = 0; i < 24; i++) {
    const hourDate = setHours(startOfDay(date), i);
    let irrigation = 0;
    if (i >= 2 && i <= 5) { // Irrigation mostly between 2am and 5am
      irrigation = Math.floor(Math.random() * 80 + 20);
    }
    
    let shower = 0;
    if ((i >= 6 && i <= 8) || (i >= 18 && i <= 21)) {
      shower = Math.floor(Math.random() * 20 + 5);
    }

    data.push({
      time: format(hourDate, 'h a'),
      hour: i,
      fullDate: hourDate,
      Irrigation: irrigation,
      Shower: shower,
      Toilet: Math.floor(Math.random() * 5),
      'Washing Machine': i === 10 || i === 14 ? Math.floor(Math.random() * 20 + 10) : 0,
      Faucet: Math.floor(Math.random() * 3),
    });
  }
  return data;
};

const generateMinuteData = (date: Date) => {
  const data = [];
  const hour = date.getHours();
  const isIrrigationHour = hour >= 2 && hour <= 5;
  
  let currentZoneIdx = 0;
  let cycleCount = 0;

  for (let i = 0; i < 60; i++) {
    const minDate = setMinutes(date, i);
    const entry: any = {
      time: format(minDate, 'h:mm a'),
      minute: i,
      fullDate: minDate,
    };

    if (isIrrigationHour) {
      // Simulate cycle and soak: 8 mins per zone
      if (cycleCount >= 8) {
        cycleCount = 0;
        currentZoneIdx = (currentZoneIdx + 1) % 6;
      }
      
      ZONES.forEach((z, idx) => {
        if (idx === currentZoneIdx) {
          // Add some noise to GPM
          entry[z] = parseFloat((Math.random() * 1 + 3).toFixed(1)); // 3-4 GPM
        } else {
          entry[z] = 0;
        }
      });
      cycleCount++;
      
      entry.Shower = 0;
      entry.Toilet = 0;
      entry['Washing Machine'] = 0;
      entry.Faucet = 0;
    } else {
      ZONES.forEach(z => entry[z] = 0);
      entry.Shower = Math.random() > 0.8 ? parseFloat((Math.random() * 2 + 1).toFixed(1)) : 0;
      entry.Toilet = Math.random() > 0.9 ? 1.5 : 0;
      entry['Washing Machine'] = 0;
      entry.Faucet = Math.random() > 0.7 ? parseFloat((Math.random() * 1 + 0.5).toFixed(1)) : 0;
    }

    data.push(entry);
  }
  return data;
};

export default function FlumeChart({ realData, rachioEvents }: { realData?: any, rachioEvents?: any[] }) {
  const [viewLevel, setViewLevel] = useState<'daily' | 'hourly' | 'minute'>('daily');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedHourDate, setSelectedHourDate] = useState<Date | null>(null);

  // If realData is provided, we could map it here. For now, we'll use the mock generators
  // as a fallback if realData is missing or empty.
  // In a full implementation, we would map realData.data[0][request_id] to the chart format.
  const hasRealData = realData && realData.data && realData.data[0] && realData.data[0]['daily_30'];
  
  const dailyData = useMemo(() => {
    if (hasRealData) {
      // Map real Flume daily data
      const flumeDaily = realData.data[0]['daily_30'];
      const mapped = flumeDaily.map((entry: any) => {
        const date = new Date(entry.datetime);
        const dayKey = format(date, 'yyyy-MM-dd');
        
        // Check if Rachio watered on this day
        let wateredToday = false;
        if (rachioEvents && rachioEvents.length > 0) {
          wateredToday = rachioEvents.some(e => {
            const eDate = new Date(e.eventDate);
            return format(eDate, 'yyyy-MM-dd') === dayKey && (e.type === 'WATERING' || e.summary?.includes('watering'));
          });
        }

        // If we know Rachio didn't run, Irrigation is 0. Otherwise, we estimate based on total.
        // In a real app, we'd use Flume's actual tags if available.
        const irrigationGallons = wateredToday ? entry.value * 0.6 : 0;
        const remainingGallons = entry.value - irrigationGallons;

        return {
          date: format(date, 'MMM do'),
          fullDate: date,
          Irrigation: irrigationGallons,
          Shower: remainingGallons * 0.4,
          Toilet: remainingGallons * 0.3,
          'Washing Machine': remainingGallons * 0.2,
          Faucet: remainingGallons * 0.1,
        };
      });
      return mapped.sort((a: any, b: any) => a.fullDate.getTime() - b.fullDate.getTime());
    }
    return generateDailyData();
  }, [realData, hasRealData, rachioEvents]);

  const hourlyData = useMemo(() => {
    if (hasRealData && selectedDate && realData.data[0]['hourly_30']) {
      const flumeHourly = realData.data[0]['hourly_30'];
      const selectedDayKey = format(selectedDate, 'yyyy-MM-dd');
      
      const dayHourlyData = flumeHourly.filter((entry: any) => {
        return format(new Date(entry.datetime), 'yyyy-MM-dd') === selectedDayKey;
      });

      if (dayHourlyData.length > 0) {
        const mapped = dayHourlyData.map((entry: any) => {
          const date = new Date(entry.datetime);
          
          // Check if Rachio watered in this specific hour
          let wateredThisHour = false;
          if (rachioEvents && rachioEvents.length > 0) {
            wateredThisHour = rachioEvents.some(e => {
              const eDate = new Date(e.eventDate);
              return format(eDate, 'yyyy-MM-dd HH') === format(date, 'yyyy-MM-dd HH') && (e.type === 'WATERING' || e.summary?.includes('watering'));
            });
          }

          const irrigationGallons = wateredThisHour ? entry.value * 0.8 : 0;
          const remainingGallons = entry.value - irrigationGallons;

          return {
            time: format(date, 'h a'),
            fullDate: date,
            Irrigation: irrigationGallons,
            Shower: remainingGallons * 0.4,
            Toilet: remainingGallons * 0.3,
            'Washing Machine': remainingGallons * 0.2,
            Faucet: remainingGallons * 0.1,
          };
        });
        return mapped.sort((a: any, b: any) => a.fullDate.getTime() - b.fullDate.getTime());
      }
    }
    return selectedDate ? generateHourlyData(selectedDate) : [];
  }, [selectedDate, realData, hasRealData, rachioEvents]);
  const minuteData = useMemo(() => selectedHourDate ? generateMinuteData(selectedHourDate) : [], [selectedHourDate]);

  const handleBarClick = (data: any) => {
    if (!data || !data.activePayload || !data.activePayload.length) return;
    
    const payload = data.activePayload[0].payload;
    
    if (viewLevel === 'daily') {
      setSelectedDate(payload.fullDate);
      setViewLevel('hourly');
    } else if (viewLevel === 'hourly') {
      setSelectedHourDate(payload.fullDate);
      setViewLevel('minute');
    }
  };

  const handleBack = () => {
    if (viewLevel === 'minute') {
      setViewLevel('hourly');
      setSelectedHourDate(null);
    } else if (viewLevel === 'hourly') {
      setViewLevel('daily');
      setSelectedDate(null);
    }
  };

  let currentData: any[] = [];
  let xAxisKey = '';
  let barsToRender: string[] = [];
  let title = '';
  let yAxisLabel = '';

  if (viewLevel === 'daily') {
    currentData = dailyData;
    xAxisKey = 'date';
    barsToRender = CATEGORIES;
    title = 'Past 7 Days Usage';
    yAxisLabel = 'Gallons / Day';
  } else if (viewLevel === 'hourly') {
    currentData = hourlyData;
    xAxisKey = 'time';
    barsToRender = CATEGORIES;
    title = `Usage on ${selectedDate ? format(selectedDate, 'MMM do') : ''}`;
    yAxisLabel = 'Gallons / Hour';
  } else if (viewLevel === 'minute') {
    currentData = minuteData;
    xAxisKey = 'time';
    // If it's an irrigation hour, show zones. Otherwise show categories.
    const isIrrigationHour = selectedHourDate && selectedHourDate.getHours() >= 2 && selectedHourDate.getHours() <= 5;
    barsToRender = isIrrigationHour ? [...ZONES, ...CATEGORIES] : CATEGORIES;
    title = `Usage on ${selectedHourDate ? format(selectedHourDate, 'MMM do, h a') : ''}`;
    yAxisLabel = 'Gallons / Minute (GPM)';
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-800">{title}</h3>
        {viewLevel !== 'daily' && (
          <Button variant="outline" size="sm" onClick={handleBack} className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to {viewLevel === 'minute' ? 'Hourly' : 'Daily'}
          </Button>
        )}
      </div>
      
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="h-[400px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={currentData}
              onClick={handleBarClick}
              margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis 
                dataKey={xAxisKey} 
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#64748b', fontSize: 12 }}
                dy={10}
              />
              <YAxis 
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#64748b', fontSize: 12 }}
                label={{ value: yAxisLabel, angle: -90, position: 'insideLeft', fill: '#64748b', dy: 50 }}
              />
              <Tooltip 
                cursor={{ fill: '#f1f5f9' }}
                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
              />
              <Legend wrapperStyle={{ paddingTop: '20px' }} />
              {barsToRender.map((key) => (
                <Bar 
                  key={key} 
                  dataKey={key} 
                  stackId="a" 
                  fill={COLORS[key] || '#cbd5e1'} 
                  radius={viewLevel === 'minute' ? [2, 2, 0, 0] : [0, 0, 0, 0]} // Only top rounded for stacked bars if it's the top one, but recharts handles radius weirdly on stacked. We'll just keep it simple.
                  style={{ cursor: viewLevel !== 'minute' ? 'pointer' : 'default' }}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
        {viewLevel !== 'minute' && (
          <p className="text-center text-sm text-slate-500 mt-4 italic">
            Click on a bar to drill down into {viewLevel === 'daily' ? 'hourly' : 'minute-by-minute'} details.
          </p>
        )}
      </div>
    </div>
  );
}
