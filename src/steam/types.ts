export type SteamAsset = {
  appid: number;
  contextid: string;
  assetid: string;
  classid: string;
  instanceid: string;
  amount: string;
};

export type SteamDescription = {
  appid: number;
  classid: string;
  instanceid: string;
  market_hash_name?: string;
  market_name?: string;
  marketable?: number;
};

export type SteamInventoryPage = {
  assets?: SteamAsset[];
  descriptions?: SteamDescription[];
  total_inventory_count?: number;
  success: number;
  more_items?: number;
  last_assetid?: string;
};
