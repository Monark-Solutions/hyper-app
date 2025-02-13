export interface ScreenInfo {
  screenname: string;
  screenlocation: string;
  screentotalviews: number;
}

export interface ReportData {
  campaignname: string;
  startdate: string;
  enddate: string;
  totalsites: number;
  totalviews: number;
  thumbnail: string;
  screeninfo: ScreenInfo[];
}

export interface ReportPreviewProps {
  data: ReportData;
  startDate: string;
  endDate: string;
  className?: string;
}

export interface SelectOption {
  value: string;
  label: string;
}

export interface ScreenOption {
  value: string;
  label: string;
}

export interface ScreenActivity {
  screens: {
    screenname: string;
  };
  logheader: string;
  logtype: string;
  logdatetime: string;
}

export interface ScreenPerformance {
  screen_name: string;
  screen_location: string;
  start_time: string;
  end_time: string;
  expected_screentime: number;
  average_screentime: number;
  performance: number;
}
