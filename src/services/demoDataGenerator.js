import { DEMO_REGIONS } from '../constants/defaultData';

// A fixed calendar date goes stale: the Today and 7d presets land on an empty
// table. Day 0 is the day the sample is generated — read per call, not at module
// scope, or a long-lived server would bake the date in at boot.
export function generateDemoCDRData(extNameMap) {
  const TODAY = new Date();
  const dayDate = (offset) => new Date(TODAY.getFullYear(), TODAY.getMonth(), TODAY.getDate() + offset);

  const demoCalls = [];
  const exts = Object.keys(extNameMap);
  const regions = DEMO_REGIONS;

  exts.forEach((ext, idx) => {
    const callCount = Math.floor(Math.random() * 20) + 12;
    let currentMinutes = 20 * 60 + 10 + (idx * 2); // Start around 20:10 (8:10 PM)

    for (let i = 0; i < callCount; i++) {
      const durationSec = Math.random() > 0.35 ? Math.floor(Math.random() * 280) + 15 : 0;
      const response = durationSec > 0 ? 'ANSWERED' : (Math.random() > 0.5 ? 'NO ANSWER' : 'BUSY');
      const region = regions[Math.floor(Math.random() * regions.length)];

      const daysToAdd = Math.floor(currentMinutes / 1440);
      const minsInDay = currentMinutes % 1440;

      const startHrs = Math.floor(minsInDay / 60);
      const startMins = minsInDay % 60;
      const startSecs = Math.floor(Math.random() * 60);

      const dObj = dayDate(daysToAdd);
      const yyyy = dObj.getFullYear();
      const mm = String(dObj.getMonth() + 1).padStart(2, '0');
      const dd = String(dObj.getDate()).padStart(2, '0');
      const dateStr = `${yyyy}-${mm}-${dd}`;

      const startStr = `${dateStr} ${String(startHrs).padStart(2, '0')}:${String(startMins).padStart(2, '0')}:${String(startSecs).padStart(2, '0')}`;
      
      const endMinutes = currentMinutes + Math.floor(durationSec / 60);
      const endDaysToAdd = Math.floor(endMinutes / 1440);
      const endMinsInDay = endMinutes % 1440;
      const endHrs = Math.floor(endMinsInDay / 60);
      const endMins = endMinsInDay % 60;
      const endSecs = (startSecs + (durationSec % 60)) % 60;

      const dObjEnd = dayDate(endDaysToAdd);
      const yyyyEnd = dObjEnd.getFullYear();
      const mmEnd = String(dObjEnd.getMonth() + 1).padStart(2, '0');
      const ddEnd = String(dObjEnd.getDate()).padStart(2, '0');
      const endDateStr = `${yyyyEnd}-${mmEnd}-${ddEnd}`;

      const endStr = `${endDateStr} ${String(endHrs).padStart(2, '0')}:${String(endMins).padStart(2, '0')}:${String(endSecs).padStart(2, '0')}`;

      demoCalls.push({
        'CALL DATE (UTC)': startStr,
        'END TIME (UTC)': endStr,
        'EXTENSION': ext,
        'DIRECTION': 'OUT',
        'RESPONSE': response,
        'DURATION': String(durationSec),
        'REGION': region,
        'CLID': `155969${Math.floor(10000 + Math.random() * 90000)}`,
        'DESTINATION': `1415${Math.floor(1000000 + Math.random() * 9000000)}`
      });

      let gap = Math.floor(Math.random() * 8) + 1;
      if (i === Math.floor(callCount / 2)) {
        gap = Math.floor(Math.random() * 25) + 18; // Long break gap
      }
      currentMinutes += Math.ceil(durationSec / 60) + gap;
    }
  });

  return demoCalls;
}
