ALTER TABLE stdcm_search_environment
ADD COLUMN temporary_speed_limit_group_id int8 REFERENCES temporary_speed_limit_group(id);