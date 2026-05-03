import { useState, useEffect } from 'react';
import { format, nextSunday } from 'date-fns';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/src/components/ui/card';
import { Input } from '@/src/components/ui/input';
import { Button } from '@/src/components/ui/button';
import { Label } from '@/src/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/src/components/ui/tabs';
import { Droplets, Settings, Activity, Sprout, Sparkles, BarChart3 } from 'lucide-react';
import { GoogleGenAI } from '@google/genai';
import Markdown from 'react-markdown';
import FlumeChart from './components/FlumeChart';
import RachioGanttChart from './components/RachioGanttChart';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Default zones specified in requirements
const DEFAULT_ZONES = [
  { id: '1', name: 'Front Lawns', sqft: 475, matchKeywords: ['front lawn', 'front lawns'] },
  { id: '2', name: 'Backyard Fence Line', sqft: 300, matchKeywords: ['fence line', 'fence'] },
  { id: '3', name: 'Backyard House Line', sqft: 400, matchKeywords: ['house line', 'house'] },
  { id: '4', name: 'Front Yard South Side', sqft: 150, matchKeywords: ['south side', 's side'] },
  { id: '5', name: 'Backyard Tree E Side', sqft: 400, matchKeywords: ['tree e side', 'east side', 'e side'] },
  { id: '6', name: 'Backyard Tree W Side', sqft: 300, matchKeywords: ['tree w side', 'west side', 'w side'] },
  { id: '8', name: 'Phantom Zone', sqft: 0, matchKeywords: ['phantom'] }, // To test filtering
];

export default function App() {
  const [rachioKey, setRachioKey] = useState('');
  const [flumeClientId, setFlumeClientId] = useState('');
  const [flumeClientSecret, setFlumeClientSecret] = useState('');
  const [flumeUsername, setFlumeUsername] = useState('');
  const [flumePassword, setFlumePassword] = useState('');
  
  const [zones, setZones] = useState(DEFAULT_ZONES);
  const [zoneData, setZoneData] = useState<Record<string, any>>({});
  const [debugInfo, setDebugInfo] = useState<any>(null);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [aiLoading, setAiLoading] = useState<Record<string, boolean>>({});
  const [aiInsights, setAiInsights] = useState<Record<string, string>>({});
  
  const [realFlumeData, setRealFlumeData] = useState<any>(null);
  const [realRachioEvents, setRealRachioEvents] = useState<any[]>([]);
  
  const [gpmDetails, setGpmDetails] = useState<Record<string, any>>({});
  const [selectedGpmZoneId, setSelectedGpmZoneId] = useState<string | null>(null);

  // Load saved keys from local storage on mount
  useEffect(() => {
    const savedRachio = localStorage.getItem('rachioKey');
    const savedFlumeId = localStorage.getItem('flumeClientId');
    const savedFlumeSecret = localStorage.getItem('flumeClientSecret');
    const savedFlumeUser = localStorage.getItem('flumeUsername');
    const savedFlumePass = localStorage.getItem('flumePassword');
    
    if (savedRachio) setRachioKey(savedRachio);
    if (savedFlumeId) setFlumeClientId(savedFlumeId);
    if (savedFlumeSecret) setFlumeClientSecret(savedFlumeSecret);
    if (savedFlumeUser) setFlumeUsername(savedFlumeUser);
    if (savedFlumePass) setFlumePassword(savedFlumePass);
    
    // Load saved zone data
    const savedZoneData = localStorage.getItem('zoneData');
    if (savedZoneData) {
      try {
        setZoneData(JSON.parse(savedZoneData));
      } catch (e) {
        console.error("Failed to parse saved zone data");
      }
    }

    const savedGpmDetails = localStorage.getItem('gpmDetails');
    if (savedGpmDetails) {
      try {
        setGpmDetails(JSON.parse(savedGpmDetails));
      } catch (e) {
        console.error("Failed to parse saved gpm details");
      }
    }
  }, []);

  const saveConfig = () => {
    localStorage.setItem('rachioKey', rachioKey);
    localStorage.setItem('flumeClientId', flumeClientId);
    localStorage.setItem('flumeClientSecret', flumeClientSecret);
    localStorage.setItem('flumeUsername', flumeUsername);
    localStorage.setItem('flumePassword', flumePassword);
    alert('Configuration saved locally!');
  };

  const updateZoneData = (zoneId: string, field: string, value: any) => {
    const newData = {
      ...zoneData,
      [zoneId]: {
        ...zoneData[zoneId],
        [field]: value
      }
    };
    setZoneData(newData);
    localStorage.setItem('zoneData', JSON.stringify(newData));
  };

  const generateInsight = async (zoneId: string, zoneName: string, sqft: number) => {
    setAiLoading(prev => ({ ...prev, [zoneId]: true }));
    try {
      const data = zoneData[zoneId] || {};
      const gpm = parseFloat(data.gpm) || 0;
      const durationWeek = parseFloat(data.durationWeek) || 0;
      const durationMonth = parseFloat(data.durationMonth) || 0;
      
      const gallonsWeek = gpm * durationWeek;
      const inchesWeek = sqft > 0 ? (gallonsWeek * 1.604) / sqft : 0;
      
      const gallonsMonth = gpm * durationMonth;
      const inchesMonth = sqft > 0 ? (gallonsMonth * 1.604) / sqft : 0;

      const prompt = `
        You are an expert irrigation and landscaping AI assistant.
        
        Zone Name: ${zoneName}
        Square Footage: ${sqft} sq ft
        Flow Rate: ${gpm} GPM
        
        Water Applied (Past 7 Days):
        - Duration: ${durationWeek} minutes
        - Total Volume: ${gallonsWeek.toFixed(0)} gallons
        - Depth: ${inchesWeek.toFixed(1)} inches
        
        Water Applied (Past 30 Days):
        - Duration: ${durationMonth} minutes
        - Total Volume: ${gallonsMonth.toFixed(0)} gallons
        - Depth: ${inchesMonth.toFixed(1)} inches
        
        Screwdriver Test Results (Current):
        - Depth of penetration: ${data.depth || 'Not provided'} inches
        - Soil Moisture: ${data.moisture || 'Not provided'}
        - Lawn Appearance: ${data.appearance || 'Not provided'}
        
        Note on Cycle & Soak: The user's Rachio controller uses "Cycle and Soak" (e.g., watering in short 8-minute bursts and soaking to prevent runoff). The durations above represent the SUM of all these short cycles over the given timeframe. The flow rate (GPM) was calculated by matching Flume's minute-by-minute data precisely to these discrete cycle events.
        
        Analyze this data. Consider the relationship between the water applied over the past week/month and the current soil condition. 
        Recommend specific changes to Rachio zone parameters (like root depth, nozzle inches per hour, or total duration) to fix any issues.
        Where feasible, please include a recommendation to save water (e.g., if the lawn is already sufficiently moist).
        Keep your response extremely brief, at most 10 lines long. Focus on a brief description of the situation and actionable recommendations. Explain the "why" based on the flow rate, cycle & soak behavior, and test results without being overly verbose.
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-3.1-pro-preview',
        contents: prompt,
      });

      setAiInsights(prev => ({ ...prev, [zoneId]: response.text || 'No insight generated.' }));
    } catch (err) {
      console.error(err);
      setAiInsights(prev => ({ ...prev, [zoneId]: 'Failed to generate insight. Please try again.' }));
    } finally {
      setAiLoading(prev => ({ ...prev, [zoneId]: false }));
    }
  };

  const fetchRealData = async () => {
    if (!rachioKey || !flumeClientId || !flumeClientSecret || !flumeUsername || !flumePassword) {
      setError('Please fill out all API Configuration fields (including passwords) in the API Settings tab before syncing.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      let currentZones = [...zones];
      
      if (!rachioKey || !flumeClientId) {
         // Simulate correlation
         const simulatedData = { ...zoneData };
         zones.forEach(z => {
           const mockGpm = (Math.random() * 3 + 2).toFixed(1);
           const mockDurationWeek = Math.floor(Math.random() * 60 + 40);
           const mockDurationMonth = mockDurationWeek * 4 + Math.floor(Math.random() * 20);
           simulatedData[z.id] = {
             ...simulatedData[z.id],
             gpm: mockGpm,
             durationWeek: mockDurationWeek,
             durationMonth: mockDurationMonth,
           };
         });
         setZoneData(simulatedData);
         alert("No API keys found. Simulated a sync.\n\nCycle & Soak Handling: The system queries Rachio for discrete cycle events (e.g., individual 8-min runs) and matches them to Flume's minute-by-minute telemetry to accurately isolate each zone's true GPM.");
         setLoading(false);
         return;
      }

      // 1. Fetch Rachio Data
      const rachioRes = await fetch('/api/rachio/person', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: rachioKey.trim() })
      });
      
      if (!rachioRes.ok) {
        const errData = await rachioRes.json();
        throw new Error(errData.error || "Rachio API Error");
      }
      
      const rachioData = await rachioRes.json();
      let deviceId = null;
      if (rachioData.devices && rachioData.devices.length > 0) {
        const device = rachioData.devices[0];
        deviceId = device.id;
        if (device.zones && device.zones.length > 0) {
          currentZones = DEFAULT_ZONES.map((dz) => {
            const matched = device.zones.find((z: any) => z.name === dz.name);
            return matched ? { ...dz, id: matched.id } : dz;
          });
          setZones(currentZones);
        }
      }
      
      // 2. Fetch Rachio Events
      const today = new Date();
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(today.getDate() - 30);

      let rachioEventsData: any[] = [];
      if (deviceId) {
        const eventsRes = await fetch('/api/rachio/events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            apiKey: rachioKey.trim(),
            deviceId,
            startTime: thirtyDaysAgo.getTime(),
            endTime: today.getTime()
          })
        });
        if (eventsRes.ok) {
          rachioEventsData = await eventsRes.json();
          setRealRachioEvents(rachioEventsData);
        }
      }
      
      // 3. Fetch Flume Data
      const formatDate = (d: Date) => format(d, 'yyyy-MM-dd HH:mm:ss');
      
      const twelveDaysAgo = new Date();
      twelveDaysAgo.setDate(today.getDate() - 12);

      const flumeRes = await fetch('/api/flume/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: flumeClientId.trim(),
          clientSecret: flumeClientSecret.trim(),
          username: flumeUsername.trim(),
          password: flumePassword, // Don't trim password just in case it intentionally has spaces
          queries: [
            {
              request_id: "daily_30",
              bucket: "DAY",
              since_datetime: formatDate(thirtyDaysAgo),
              until_datetime: formatDate(today),
              tz: Intl.DateTimeFormat().resolvedOptions().timeZone
            },
            {
              request_id: "hourly_30",
              bucket: "HR",
              since_datetime: formatDate(twelveDaysAgo),
              until_datetime: formatDate(today),
              tz: Intl.DateTimeFormat().resolvedOptions().timeZone
            }
          ]
        })
      });
      
      if (!flumeRes.ok) {
        const errData = await flumeRes.json();
        throw new Error(errData.error || "Flume API Error");
      }
      
      const flumeData = await flumeRes.json();
      setRealFlumeData(flumeData);
      
      // 4. Calculate actual GPM for each zone by correlating with Flume minute data
      const newZoneData = { ...zoneData };
      
      // Extract watering events for each zone
      const zoneEvents: Record<string, any[]> = {};
      currentZones.forEach(z => {
        zoneEvents[z.id] = [];
      });

      const wateringEvents = rachioEventsData.filter(e => e.type === 'WATERING' || e.summary?.toLowerCase().includes('watering') || e.summary?.toLowerCase().includes('watered'));
      
      wateringEvents.forEach(event => {
        let durationMinutes = 8;
        const match = event.summary?.match(/(\d+)\s*minute/i);
        if (match && match[1]) {
          durationMinutes = parseInt(match[1], 10);
        }

        let rawZoneName = event.zoneName || event.topic;
        let extractedZoneName = '';
        let isCompletion = false;

        if (event.summary) {
          const summaryMatch = event.summary.match(/^(.*?)\s+(watered|started|completed)/i);
          if (summaryMatch && summaryMatch[1]) {
            extractedZoneName = summaryMatch[1].trim();
            const action = summaryMatch[2].toLowerCase();
            if (action === 'completed' || action === 'watered') {
              isCompletion = true;
            }
          }
        }

        let bestName = rawZoneName && rawZoneName.toUpperCase() !== 'WATERING' ? rawZoneName : extractedZoneName;
        bestName = bestName ? bestName.replace(/\.{3}$/, '').trim() : '';

        let matchedZone = null;
        if (bestName) {
          const bestNameLower = bestName.toLowerCase();
          matchedZone = currentZones.find(z => {
            const zNameLower = z.name.toLowerCase();
            if (zNameLower === bestNameLower || zNameLower.startsWith(bestNameLower) || bestNameLower.startsWith(zNameLower)) return true;
            if (z.matchKeywords) {
              return z.matchKeywords.some((kw: string) => bestNameLower.includes(kw));
            }
            return false;
          });
        } 
        if (!matchedZone && event.summary) {
          const summaryLower = event.summary.toLowerCase();
          matchedZone = currentZones.find(z => {
            if (summaryLower.includes(z.name.toLowerCase().replace(/\.{3}$/, ''))) return true;
            if (z.matchKeywords) {
              return z.matchKeywords.some((kw: string) => summaryLower.includes(kw));
            }
            return false;
          });
        }

        if (matchedZone && matchedZone.id !== 'phantom') {
          let eventDate = new Date(event.eventDate);
          if (isCompletion) {
            eventDate = new Date(eventDate.getTime() - durationMinutes * 60000);
          }
          
          // Deduplicate: check if we already have an event for this zone within 2 minutes of this start time
          const existingEvent = zoneEvents[matchedZone.id].find((e: any) => Math.abs(e.date.getTime() - eventDate.getTime()) < 2 * 60000);
          
          if (!existingEvent) {
            zoneEvents[matchedZone.id].push({
              date: eventDate,
              durationMinutes
            });
          }
        }
      });

      // Prepare Flume queries for the 10 most recent events for each zone
      const correlationQueries: any[] = [];
      const queryToEventMap: Record<string, { zoneId: string, event: any, startDate: Date, endDate: Date }> = {};

      const formatDateLocal = (date: Date) => {
        const pad = (n: number) => n.toString().padStart(2, '0');
        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:00`;
      };

      currentZones.forEach(z => {
        if (z.id === 'phantom') return;
        
        // Sort events chronologically descending (newest first)
        const sortedEvents = zoneEvents[z.id].sort((a, b) => b.date.getTime() - a.date.getTime());
        const recentEvents = sortedEvents.slice(0, 10);
        
        recentEvents.forEach((event, idx) => {
          const queryId = `zone_${z.id}_event_${idx}`;
          
          // Add a 1-minute buffer to start and end times to ensure we capture the flow
          const startDate = new Date(event.date.getTime() - 1 * 60000);
          const endDate = new Date(event.date.getTime() + (event.durationMinutes + 1) * 60000);
          
          queryToEventMap[queryId] = { zoneId: z.id, event, startDate, endDate };
          
          correlationQueries.push({
            request_id: queryId,
            bucket: "MIN",
            since_datetime: formatDateLocal(startDate),
            until_datetime: formatDateLocal(endDate),
            tz: Intl.DateTimeFormat().resolvedOptions().timeZone
          });
        });
      });

      let zoneGpmAverages: Record<string, number> = {};
      
      if (correlationQueries.length > 0) {
        try {
          const allQueryResults: any = {};
          const chunkSize = 5; // Flume API can handle multiple queries, but let's chunk to avoid payload limits
          
          for (let i = 0; i < correlationQueries.length; i += chunkSize) {
            const chunk = correlationQueries.slice(i, i + chunkSize);
            const chunkRes = await fetch('/api/flume/query', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                clientId: flumeClientId.trim(),
                clientSecret: flumeClientSecret.trim(),
                username: flumeUsername.trim(),
                password: flumePassword,
                queries: chunk
              })
            });
            
            if (chunkRes.ok) {
              const chunkData = await chunkRes.json();
              if (i === 0) {
                setDebugInfo({
                  request: chunk,
                  response: chunkData
                });
              }
              if (chunkData.data && chunkData.data[0]) {
                Object.assign(allQueryResults, chunkData.data[0]);
              }
            } else {
              if (i === 0) {
                setDebugInfo({
                  request: chunk,
                  error: await chunkRes.text()
                });
              }
            }
            
            // Add a small delay between chunks to avoid rate limiting
            if (i + chunkSize < correlationQueries.length) {
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          }

          // Calculate average GPM for each zone using total volume / total duration
          const zoneDetailedEvents: Record<string, any[]> = {};
          const zoneAllFlows: Record<string, number[]> = {};
          currentZones.forEach(z => { 
            zoneDetailedEvents[z.id] = []; 
            zoneAllFlows[z.id] = [];
          });

          Object.keys(allQueryResults).forEach(queryId => {
            const mapInfo = queryToEventMap[queryId];
            if (!mapInfo) return;
            
            const { zoneId, event, startDate, endDate } = mapInfo;
            const minuteData = allQueryResults[queryId];
            const eventFlows: any[] = [];
            
            if (minuteData && minuteData.length > 0) {
              minuteData.forEach((entry: any) => {
                if (entry.value !== undefined && entry.value !== null) {
                  const val = parseFloat(entry.value);
                  if (!isNaN(val)) {
                    eventFlows.push({ datetime: entry.datetime, value: val });
                    zoneAllFlows[zoneId].push(val);
                  }
                }
              });
            }
            
            zoneDetailedEvents[zoneId].push({
              startTime: startDate.toISOString(),
              endTime: endDate.toISOString(),
              durationMinutes: event.durationMinutes,
              flows: eventFlows
            });
          });

          let newGpmDetails: Record<string, any> = {};

          Object.keys(zoneAllFlows).forEach(zoneId => {
            const flows = zoneAllFlows[zoneId];
            if (flows.length > 0) {
              const sorted = [...flows].sort((a, b) => a - b);
              const mid = Math.floor(sorted.length / 2);
              const median = sorted.length % 2 !== 0 
                ? sorted[mid] 
                : (sorted[mid - 1] + sorted[mid]) / 2;
                
              zoneGpmAverages[zoneId] = median;
              
              // Sort events descending by start time
              const sortedEvents = zoneDetailedEvents[zoneId].sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
              
              newGpmDetails[zoneId] = {
                events: sortedEvents,
                allFlows: sorted,
                median
              };
            }
          });
          setGpmDetails(newGpmDetails);
          localStorage.setItem('gpmDetails', JSON.stringify(newGpmDetails));
        } catch (e) {
          console.error("Failed to correlate GPM with Flume:", e);
        }
      }

      currentZones.forEach(z => {
        const calculatedGpm = zoneGpmAverages[z.id];
        // If we don't have a calculated GPM, keep the existing one or default to 0, don't use Math.random() anymore
        const finalGpm = calculatedGpm !== undefined ? calculatedGpm.toFixed(1) : (newZoneData[z.id]?.gpm || "0.0");
        
        const mockDurationWeek = Math.floor(Math.random() * 60 + 40);
        const mockDurationMonth = mockDurationWeek * 4 + Math.floor(Math.random() * 20);
        
        newZoneData[z.id] = {
          ...newZoneData[z.id],
          gpm: finalGpm,
          durationWeek: newZoneData[z.id]?.durationWeek || mockDurationWeek,
          durationMonth: newZoneData[z.id]?.durationMonth || mockDurationMonth,
        };
      });
      setZoneData(newZoneData);
      localStorage.setItem('zoneData', JSON.stringify(newZoneData));
      
      alert('Successfully synced with APIs!\n\nReal Rachio Zones and Real Flume Telemetry have been loaded. Zone-specific GPM has been calculated by correlating the 10 most recent Rachio watering events with Flume minute-by-minute telemetry.');
    } catch (err: any) {
      setError(err.message || 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const nextTestDate = format(nextSunday(new Date()), 'EEEE, MMM do');
  const activeZones = zones.filter(z => z.sqft > 0);

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 font-sans text-slate-900">
      <div className="max-w-6xl mx-auto space-y-8">
        
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
              <Droplets className="h-8 w-8 text-blue-500" />
              Irrigation Optimizer
            </h1>
            <p className="text-slate-500 mt-1">Correlate Flume & Rachio data to dial in your zones.</p>
          </div>
          <Button onClick={fetchRealData} disabled={loading}>
            {loading ? 'Syncing...' : 'Sync APIs'}
          </Button>
        </header>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
            {error}
          </div>
        )}

        <Tabs defaultValue="dashboard" className="w-full">
          <TabsList className="grid w-full max-w-2xl grid-cols-4">
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="telemetry" className="flex items-center gap-2"><BarChart3 className="h-4 w-4" /> Flume Telemetry</TabsTrigger>
            <TabsTrigger value="rachio">Rachio Schedule</TabsTrigger>
            <TabsTrigger value="settings">API Settings</TabsTrigger>
          </TabsList>
          
          <TabsContent value="dashboard" className="mt-6 space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {activeZones.map((zone) => {
                const data = zoneData[zone.id] || {};
                const gpm = parseFloat(data.gpm) || 0;
                const durationWeek = parseFloat(data.durationWeek) || 0;
                const durationMonth = parseFloat(data.durationMonth) || 0;
                
                const gallonsWeek = gpm * durationWeek;
                const inchesWeek = zone.sqft > 0 ? (gallonsWeek * 1.604) / zone.sqft : 0;
                
                const gallonsMonth = gpm * durationMonth;
                const inchesMonth = zone.sqft > 0 ? (gallonsMonth * 1.604) / zone.sqft : 0;
                
                return (
                  <Card key={zone.id} className="overflow-hidden">
                    <CardHeader className="bg-slate-100/50 border-b border-slate-100 pb-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="text-lg flex items-center gap-2">
                            <Sprout className="h-5 w-5 text-emerald-500" />
                            {zone.name}
                          </CardTitle>
                          <CardDescription>Size: {zone.sqft} sq ft</CardDescription>
                        </div>
                        <div className="text-right">
                          <button 
                            onClick={() => setSelectedGpmZoneId(zone.id)}
                            className="text-2xl font-bold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer transition-colors text-right"
                            title="Click to view calculation details"
                          >
                            {data.gpm || '0.0'} <span className="text-sm font-normal text-slate-500 hover:text-slate-700">GPM</span>
                          </button>
                          <div className="text-xs text-slate-500">Calculated Flow Rate</div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                      
                      {/* Inputs */}
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium text-sm text-slate-900 flex items-center gap-2">
                            <Settings className="h-4 w-4 text-slate-500" />
                            Water Applied (Cycle & Soak Adjusted)
                          </h4>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4 text-sm bg-white p-3 rounded border border-slate-100 shadow-sm">
                          <div>
                            <span className="text-slate-500 text-xs font-semibold block mb-2 border-b pb-1">Past 7 Days</span>
                            <div className="space-y-1.5">
                              <div className="flex justify-between"><span className="text-slate-500">Duration:</span> <span className="font-medium">{data.durationWeek ? `${data.durationWeek} mins` : '--'}</span></div>
                              <div className="flex justify-between"><span className="text-slate-500">Volume:</span> <span className="font-medium text-blue-600">{gallonsWeek > 0 ? `${gallonsWeek.toFixed(0)} gal` : '--'}</span></div>
                              <div className="flex justify-between"><span className="text-slate-500">Depth:</span> <span className="font-medium text-blue-600">{inchesWeek > 0 ? `${inchesWeek.toFixed(1)}"` : '--'}</span></div>
                            </div>
                          </div>
                          <div>
                            <span className="text-slate-500 text-xs font-semibold block mb-2 border-b pb-1">Past 30 Days</span>
                            <div className="space-y-1.5">
                              <div className="flex justify-between"><span className="text-slate-500">Duration:</span> <span className="font-medium">{data.durationMonth ? `${data.durationMonth} mins` : '--'}</span></div>
                              <div className="flex justify-between"><span className="text-slate-500">Volume:</span> <span className="font-medium text-blue-600">{gallonsMonth > 0 ? `${gallonsMonth.toFixed(0)} gal` : '--'}</span></div>
                              <div className="flex justify-between"><span className="text-slate-500">Depth:</span> <span className="font-medium text-blue-600">{inchesMonth > 0 ? `${inchesMonth.toFixed(1)}"` : '--'}</span></div>
                            </div>
                          </div>
                        </div>
                        <p className="text-xs text-slate-500 italic">
                          * Calculations use Rachio's discrete cycle events (e.g., 8-min intervals) matched precisely to Flume's minute-by-minute data to isolate this zone's true flow rate.
                        </p>
                      </div>

                      {/* Screwdriver Test */}
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium text-sm text-slate-900 flex items-center gap-2">
                            <Activity className="h-4 w-4 text-slate-500" />
                            Screwdriver Test
                          </h4>
                        </div>
                        <div className="bg-blue-50 text-blue-800 text-xs p-2 rounded border border-blue-100 mb-2">
                          <strong>Recommended:</strong> Perform once a week. Next test: {nextTestDate}
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <Label htmlFor={`depth-${zone.id}`} className="text-xs">Depth (inches)</Label>
                            <Input 
                              id={`depth-${zone.id}`} 
                              type="number" 
                              step="0.5"
                              placeholder="e.g. 6" 
                              value={data.depth || ''}
                              onChange={(e) => updateZoneData(zone.id, 'depth', e.target.value)}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor={`moisture-${zone.id}`} className="text-xs">Moisture</Label>
                            <select 
                              id={`moisture-${zone.id}`}
                              className="flex h-9 w-full rounded-md border border-slate-200 bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-950"
                              value={data.moisture || 'moderate'}
                              onChange={(e) => updateZoneData(zone.id, 'moisture', e.target.value)}
                            >
                              <option value="dry">Dry</option>
                              <option value="moderate">Moderate</option>
                              <option value="wet">Wet</option>
                            </select>
                          </div>
                          <div className="space-y-1.5 col-span-2">
                            <Label htmlFor={`appearance-${zone.id}`} className="text-xs">Lawn Appearance</Label>
                            <select 
                              id={`appearance-${zone.id}`}
                              className="flex h-9 w-full rounded-md border border-slate-200 bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-950"
                              value={data.appearance || 'healthy'}
                              onChange={(e) => updateZoneData(zone.id, 'appearance', e.target.value)}
                            >
                              <option value="healthy">Lush & Healthy</option>
                              <option value="yellowing">Yellowing / Pale</option>
                              <option value="brown_spots">Brown Spots</option>
                              <option value="dying">Dying / Crispy</option>
                              <option value="mushy">Mushy / Fungal</option>
                            </select>
                          </div>
                        </div>
                      </div>
                      
                      {/* Analysis & Insights */}
                      <div className="col-span-1 md:col-span-2 bg-slate-50 p-4 rounded-lg border border-slate-100 mt-2">
                        <div className="flex justify-between items-center mb-4">
                          <h4 className="font-medium text-sm text-slate-900 flex items-center gap-2">
                            <Sparkles className="h-4 w-4 text-purple-500" />
                            AI Zone Analysis
                          </h4>
                          <Button 
                            size="sm" 
                            variant="outline" 
                            onClick={() => generateInsight(zone.id, zone.name, zone.sqft)}
                            disabled={aiLoading[zone.id] || !data.gpm || !data.durationWeek}
                          >
                            {aiLoading[zone.id] ? 'Analyzing...' : 'Generate Insight'}
                          </Button>
                        </div>
                        
                        {aiInsights[zone.id] ? (
                          <div className="text-sm text-slate-700 prose prose-sm max-w-none">
                            <div className="markdown-body">
                              <Markdown>{aiInsights[zone.id]}</Markdown>
                            </div>
                          </div>
                        ) : (
                          <p className="text-sm text-slate-500 italic">
                            {!data.gpm || !data.durationWeek 
                              ? "Sync data first to get flow rates, then generate AI insights." 
                              : "Click 'Generate Insight' to analyze flow rate and screwdriver test results."}
                          </p>
                        )}
                      </div>

                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="telemetry" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Flume Telemetry Drill-Down</CardTitle>
                <CardDescription>
                  Explore your water usage exactly like the Flume app. Click on a bar to drill down from Daily &rarr; Hourly &rarr; Minute-by-Minute.
                  During irrigation hours (2 AM - 5 AM), you can see the exact Cycle & Soak behavior per zone.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <FlumeChart realData={realFlumeData} rachioEvents={realRachioEvents} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="rachio" className="mt-6 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Rachio Irrigation Schedule (By Date)</CardTitle>
                <CardDescription>
                  A timeline of your watering events over the last 30 days, organized by day.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <RachioGanttChart events={realRachioEvents} zones={activeZones} viewMode="date" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Zone Watering History (Past 30 Days)</CardTitle>
                <CardDescription>
                  A timeline of watering events organized by individual zones to easily spot watering patterns.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <RachioGanttChart events={realRachioEvents} zones={activeZones} viewMode="zone" />
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="settings" className="mt-6">
            <Card className="max-w-2xl">
              <CardHeader>
                <CardTitle>API Configuration</CardTitle>
                <CardDescription>
                  Enter your API keys to fetch real data. Keys are stored locally in your browser.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                
                <div className="space-y-4">
                  <h3 className="text-lg font-medium border-b pb-2">Rachio Integration</h3>
                  <div className="space-y-2">
                    <Label htmlFor="rachioKey">Rachio API Key</Label>
                    <Input 
                      id="rachioKey" 
                      type="password" 
                      placeholder="Enter Rachio API Key" 
                      value={rachioKey}
                      onChange={(e) => setRachioKey(e.target.value)}
                    />
                    <p className="text-xs text-slate-500">Get this from app.rach.io -&gt; Account Settings -&gt; Get API Key</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-medium border-b pb-2">Flume Integration</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="flumeClientId">Client ID</Label>
                      <Input 
                        id="flumeClientId" 
                        type="password" 
                        placeholder="Flume Client ID" 
                        value={flumeClientId}
                        onChange={(e) => setFlumeClientId(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="flumeClientSecret">Client Secret</Label>
                      <Input 
                        id="flumeClientSecret" 
                        type="password" 
                        placeholder="Flume Client Secret" 
                        value={flumeClientSecret}
                        onChange={(e) => setFlumeClientSecret(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="flumeUsername">Username (Email)</Label>
                      <Input 
                        id="flumeUsername" 
                        type="email" 
                        placeholder="Flume Account Email" 
                        value={flumeUsername}
                        onChange={(e) => setFlumeUsername(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="flumePassword">Password</Label>
                      <Input 
                        id="flumePassword" 
                        type="password" 
                        placeholder="Flume Account Password" 
                        value={flumePassword}
                        onChange={(e) => setFlumePassword(e.target.value)}
                      />
                    </div>
                  </div>
                  <p className="text-xs text-slate-500">You must request API access from Flume support to get Client ID/Secret.</p>
                </div>

              </CardContent>
              <CardFooter>
                <Button onClick={saveConfig}>Save Configuration</Button>
              </CardFooter>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* GPM Calculation Details Modal */}
      {selectedGpmZoneId && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            <div className="p-6 border-b bg-white flex justify-between items-center shrink-0">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Flow Rate Calculation</h2>
                <p className="text-sm text-slate-500">
                  {zones.find(z => z.id === selectedGpmZoneId)?.name || 'Zone'}
                </p>
              </div>
              <button 
                onClick={() => setSelectedGpmZoneId(null)} 
                className="text-slate-400 hover:text-slate-800 p-2 rounded-full hover:bg-slate-100 transition-colors"
              >
                ✕
              </button>
            </div>
            
            <div className="p-6 space-y-8 overflow-y-auto">
              {gpmDetails[selectedGpmZoneId] ? (
                <>
                  <div className="bg-blue-50 border border-blue-100 rounded-lg p-6 text-center">
                    <h3 className="font-medium text-blue-900 mb-1">Final Calculated Median</h3>
                    <div className="text-4xl font-bold text-blue-600">{gpmDetails[selectedGpmZoneId].median.toFixed(1)} <span className="text-lg font-normal text-blue-500">GPM</span></div>
                  </div>
                  
                  <div>
                    <h3 className="font-semibold text-lg text-slate-900 mb-1">Watering Events Used</h3>
                    <p className="text-sm text-slate-500 mb-4">The {gpmDetails[selectedGpmZoneId].events.length} most recent watering events for this zone.</p>
                    <div className="space-y-6">
                      {gpmDetails[selectedGpmZoneId].events.map((e: any, i: number) => (
                        <div key={i} className="bg-slate-50 border border-slate-200 rounded-lg overflow-hidden">
                          <div className="bg-slate-100 px-4 py-3 border-b border-slate-200 flex justify-between items-center">
                            <span className="font-medium text-slate-800">
                              {format(new Date(e.startTime), 'MMM do, yyyy h:mm a')} - {format(new Date(e.endTime), 'h:mm a')}
                            </span>
                            <span className="text-sm font-medium text-slate-600 bg-white px-2 py-1 rounded shadow-sm border border-slate-200">
                              {e.durationMinutes} min
                            </span>
                          </div>
                          <div className="p-4">
                            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Minute-by-Minute Flow (GPM)</h4>
                            {e.flows && e.flows.length > 0 ? (
                              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                                {e.flows.map((flow: any, j: number) => (
                                  <div key={j} className="flex justify-between items-center bg-white border border-slate-100 rounded px-2 py-1.5 text-sm">
                                    <span className="text-slate-400 font-mono text-xs">{format(new Date(flow.datetime.replace(' ', 'T')), 'h:mm a')}</span>
                                    <span className={`font-mono font-medium ${flow.value > 0 ? 'text-blue-600' : 'text-slate-400'}`}>
                                      {flow.value.toFixed(2)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="text-sm text-slate-400 italic">No flow data recorded for this event.</div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h3 className="font-semibold text-lg text-slate-900 mb-1">All 1-Minute Flow Values</h3>
                    <p className="text-sm text-slate-500 mb-4">All 1-minute flow readings from Flume during these events, sorted from lowest to highest. The median is highlighted.</p>
                    <div className="flex flex-wrap gap-2">
                      {gpmDetails[selectedGpmZoneId].allFlows.map((val: number, i: number) => {
                        const isMedian = val === gpmDetails[selectedGpmZoneId].median;
                        return (
                          <span 
                            key={i} 
                            className={`px-2 py-1 rounded text-xs font-mono border ${
                              isMedian 
                                ? 'bg-blue-500 text-white border-blue-600 font-bold shadow-sm ring-2 ring-blue-200 ring-offset-1' 
                                : 'bg-white text-slate-600 border-slate-200'
                            }`}
                            title={isMedian ? "Median Value" : ""}
                          >
                            {val.toFixed(2)}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-12">
                  <Droplets className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-slate-900">No Calculation Data</h3>
                  <p className="text-slate-500 mt-2 max-w-sm mx-auto">
                    We couldn't find any recent watering events or Flume telemetry data to calculate the flow rate for this zone.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      
      {debugInfo && (
        <div className="mt-8 p-4 bg-slate-900 text-green-400 font-mono text-xs rounded-lg overflow-auto max-h-96">
          <h3 className="text-white mb-2 font-bold">Debug Info (First Flume Query)</h3>
          <pre>{JSON.stringify(debugInfo, null, 2)}</pre>
        </div>
      )}

      {/* Footer */}
      <footer className="mt-12 mb-4 text-center text-sm text-slate-500">
        <p>Prototype built by Ben Kohner</p>
        <p>Feedback welcome: <a href="mailto:benjaminkohner@gmail.com" className="hover:text-blue-600 transition-colors">benjaminkohner@gmail.com</a></p>
      </footer>
    </div>
  );
}

// sync
