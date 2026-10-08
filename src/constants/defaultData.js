export const DEFAULT_EXT_MAP = {
  '1040401': 'Harshita',
  '1040402': 'Unnati',
  '1040403': 'Shivani',
  '1040404': 'Yukti',
  '1040405': 'Purnima',
  '1040406': 'Shivam',
  '1040407': 'Palak',
  '1040408': 'Harshita S',
  '1040409': 'Agent 409',
  '1040410': 'Pranjali',
  '1040411': 'Aakansha',
  '1040412': 'Bhumika',
  '1040413': 'Himanshu',
  '1040414': 'Akchat',
  '1040415': 'Shreya',
  '1040416': 'Deeksha',
  '1040417': 'Ayan',
  '1040418': 'Falak',
  '1040419': 'Sakshi',
  '1040420': 'Simran'
};

export const DEFAULT_SHIFT_CONFIG = {
  breakThresholdMinutes: 10,
  shiftStartDay: 0,
  shiftStartTime: "20:00",
  shiftEndDay: 1,
  shiftEndTime: "05:00"
};

export const SHIFT_PRESETS = [
  // Same-day (start and end on Day 1)
  { group: 'Same Day', name: '06:00 - 15:00', startDay: 0, startTime: '06:00', endDay: 0, endTime: '15:00' },
  { group: 'Same Day', name: '06:30 - 15:30', startDay: 0, startTime: '06:30', endDay: 0, endTime: '15:30' },
  { group: 'Same Day', name: '09:00 - 18:00', startDay: 0, startTime: '09:00', endDay: 0, endTime: '18:00' },
  { group: 'Same Day', name: '09:30 - 18:30', startDay: 0, startTime: '09:30', endDay: 0, endTime: '18:30' },
  { group: 'Same Day', name: '13:00 - 22:00', startDay: 0, startTime: '13:00', endDay: 0, endTime: '22:00' },
  { group: 'Same Day', name: '13:30 - 22:30', startDay: 0, startTime: '13:30', endDay: 0, endTime: '22:30' },
  { group: 'Same Day', name: '14:00 - 23:00', startDay: 0, startTime: '14:00', endDay: 0, endTime: '23:00' },
  { group: 'Same Day', name: '14:30 - 23:30', startDay: 0, startTime: '14:30', endDay: 0, endTime: '23:30' },
  // Multi-day (ends on Day 2)
  { group: 'Multi Day', name: '18:00 - 03:00', startDay: 0, startTime: '18:00', endDay: 1, endTime: '03:00' },
  { group: 'Multi Day', name: '18:30 - 03:30', startDay: 0, startTime: '18:30', endDay: 1, endTime: '03:30' },
  { group: 'Multi Day', name: '19:00 - 04:00', startDay: 0, startTime: '19:00', endDay: 1, endTime: '04:00' },
  { group: 'Multi Day', name: '19:30 - 04:30', startDay: 0, startTime: '19:30', endDay: 1, endTime: '04:30' },
  { group: 'Multi Day', name: '20:00 - 05:00', startDay: 0, startTime: '20:00', endDay: 1, endTime: '05:00' },
  { group: 'Multi Day', name: '20:30 - 05:30', startDay: 0, startTime: '20:30', endDay: 1, endTime: '05:30' },
  { group: 'Multi Day', name: '21:00 - 06:00', startDay: 0, startTime: '21:00', endDay: 1, endTime: '06:00' },
  { group: 'Multi Day', name: '21:30 - 06:30', startDay: 0, startTime: '21:30', endDay: 1, endTime: '06:30' }
];

export const DEMO_REGIONS = [
  'United States / Canada',
  'India',
  'United Kingdom',
  'Australia',
  'Germany',
  'Japan'
];
