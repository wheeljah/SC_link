UPDATE ad_banners
SET advertiser_name = '비드바이브(BidVibe)'
WHERE position = 'TOP';

SELECT position, advertiser_name, message FROM ad_banners WHERE position = 'TOP';
