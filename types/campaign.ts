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
  tags: Tag[];
}

export interface Tag {
  tagid: number;
  tagname: string;
}

export interface Campaign {
  campaignid: number;
  campaignname: string;
  mediaid: number;
  startdate: string;
  enddate: string;
  customerid: string;
  playstate?: boolean;
  isdeleted: boolean;
}

export interface CampaignScreen {
  campaignid: number;
  screenid: string;
}

export interface CampaignFormProps {
  campaignId: number;
  mediaId: number;
}
