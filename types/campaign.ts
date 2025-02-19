export interface Campaign {
  campaignid: number;
  campaignname: string;
  startdate: string;
  enddate: string;
  customerid: string;
  isdeleted: boolean;
  duration: number;
  playstate?: boolean;
}

export interface CampaignFormProps {
  campaignId: number;
  mediaId: number;
  isSaving?: boolean;
  setIsSaving?: (saving: boolean) => void;
  setIsDrawerOpen: (open: boolean) => void;
}

export interface CampaignMedia {
  campaignid: number;
  mediaid: number;
  isdeleted: boolean;
}

export interface CampaignScreen {
  campaignid: number;
  screenid: string;
}

export interface Media {
  mediaid: number;
  medianame: string;
  customerid: string;
  isdeleted: boolean;
}

export interface Screen {
  id: number;
  screenid: string;
  screenname: string;
  screenlocation: string;
  customerid: string;
  isdeleted: boolean;
  latitude: number;
  longitude: number;
  tags: Tag[];
}

export interface Tag {
  tagid: number;
  tagname: string;
}
