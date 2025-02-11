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
