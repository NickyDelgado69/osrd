use chrono::NaiveDateTime;
use diesel::ExpressionMethods;
use diesel::QueryDsl;
use diesel_async::RunQueryDsl;
use serde::Serialize;
use utoipa::ToSchema;

use crate::error::Result;
use crate::modelsv2::prelude::{Create, Row};
use editoast_derive::ModelV2;
use editoast_models::DbConnection;

#[cfg(test)]
use serde::Deserialize;

#[derive(Debug, Clone, ModelV2, ToSchema, Serialize)]
#[model(table = crate::tables::stdcm_search_environment)]
#[cfg_attr(test, derive(Deserialize, PartialEq), model(changeset(derive(Clone))))]
pub struct StdcmSearchEnvironment {
    pub id: i64,
    pub infra_id: i64,
    #[schema(nullable = false)]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub electrical_profile_set_id: Option<i64>,
    #[schema(nullable = false)]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub work_schedule_group_id: Option<i64>,
    pub timetable_id: i64,
    pub search_window_begin: NaiveDateTime,
    pub search_window_end: NaiveDateTime,
}

impl StdcmSearchEnvironment {
    /// Retrieve the latest search environment. Returns None if no search environment is found.
    pub async fn retrieve_latest(conn: &mut DbConnection) -> Option<Self> {
        use crate::tables::stdcm_search_environment::dsl::*;
        stdcm_search_environment
            .order_by((search_window_end.desc(), search_window_begin.asc()))
            .first::<Row<StdcmSearchEnvironment>>(conn)
            .await
            .map(Into::into)
            .ok()
    }

    pub async fn delete_all(conn: &mut DbConnection) -> Result<()> {
        use crate::tables::stdcm_search_environment::dsl::*;
        diesel::delete(stdcm_search_environment)
            .execute(conn)
            .await?;
        Ok(())
    }
}

impl StdcmSearchEnvironmentChangeset {
    pub async fn overwrite(self, conn: &mut DbConnection) -> Result<StdcmSearchEnvironment> {
        StdcmSearchEnvironment::delete_all(conn).await?;
        self.create(conn).await
    }
}

#[cfg(test)]
pub mod test {
    use chrono::NaiveDate;
    use pretty_assertions::assert_eq;
    use rstest::rstest;
    use std::ops::DerefMut;

    use super::*;
    use crate::modelsv2::fixtures::{
        create_electrical_profile_set, create_empty_infra, create_timetable,
        create_work_schedule_group,
    };
    use crate::modelsv2::timetable::Timetable;
    use crate::modelsv2::work_schedules::WorkScheduleGroup;
    use crate::modelsv2::ElectricalProfileSet;
    use crate::modelsv2::Infra;
    use crate::modelsv2::{Count, Model, SelectionSettings};
    use editoast_models::DbConnectionPoolV2;

    pub async fn stdcm_search_env_fixtures(
        conn: &mut DbConnection,
    ) -> (Infra, Timetable, WorkScheduleGroup, ElectricalProfileSet) {
        let infra = create_empty_infra(conn).await;
        let timetable = create_timetable(conn).await;
        let work_schedule_group = create_work_schedule_group(conn).await;
        let electrical_profile_set = create_electrical_profile_set(conn).await;

        (
            infra,
            timetable,
            work_schedule_group,
            electrical_profile_set,
        )
    }

    #[rstest]
    async fn test_overwrite() {
        let db_pool = DbConnectionPoolV2::for_tests();
        let (infra, timetable, work_schedule_group, electrical_profile_set) =
            stdcm_search_env_fixtures(db_pool.get_ok().deref_mut()).await;

        let changeset_1 = StdcmSearchEnvironment::changeset()
            .infra_id(infra.id)
            .electrical_profile_set_id(Some(electrical_profile_set.id))
            .work_schedule_group_id(Some(work_schedule_group.id))
            .timetable_id(timetable.id)
            .search_window_begin(NaiveDate::from_ymd_opt(2024, 1, 1).unwrap().into())
            .search_window_end(NaiveDate::from_ymd_opt(2024, 1, 15).unwrap().into());

        let begin = NaiveDate::from_ymd_opt(2024, 1, 16).unwrap().into();
        let end = NaiveDate::from_ymd_opt(2024, 1, 31).unwrap().into();

        let changeset_2 = changeset_1
            .clone()
            .search_window_begin(begin)
            .search_window_end(end);

        changeset_1
            .create(db_pool.get_ok().deref_mut())
            .await
            .expect("Failed to create first search environment");

        assert_eq!(
            StdcmSearchEnvironment::count(db_pool.get_ok().deref_mut(), SelectionSettings::new())
                .await
                .expect("Failed to count"),
            1
        );

        let _ = changeset_2
            .overwrite(db_pool.get_ok().deref_mut())
            .await
            .expect("Failed to overwrite search environment");

        assert_eq!(
            StdcmSearchEnvironment::count(db_pool.get_ok().deref_mut(), SelectionSettings::new())
                .await
                .expect("Failed to count"),
            1
        );

        let result = StdcmSearchEnvironment::retrieve_latest(db_pool.get_ok().deref_mut())
            .await
            .expect("Failed to retrieve latest search environment");

        assert_eq!(result.search_window_begin, begin);
        assert_eq!(result.search_window_end, end);
    }

    #[rstest]
    async fn test_retrieve_latest() {
        let db_pool = DbConnectionPoolV2::for_tests();
        let (infra, timetable, work_schedule_group, electrical_profile_set) =
            stdcm_search_env_fixtures(db_pool.get_ok().deref_mut()).await;

        let too_old = StdcmSearchEnvironment::changeset()
            .infra_id(infra.id)
            .electrical_profile_set_id(Some(electrical_profile_set.id))
            .work_schedule_group_id(Some(work_schedule_group.id))
            .timetable_id(timetable.id)
            .search_window_begin(NaiveDate::from_ymd_opt(2024, 1, 1).unwrap().into())
            .search_window_end(NaiveDate::from_ymd_opt(2024, 1, 15).unwrap().into());

        let too_young = too_old
            .clone()
            .search_window_begin(NaiveDate::from_ymd_opt(2024, 1, 16).unwrap().into())
            .search_window_end(NaiveDate::from_ymd_opt(2024, 1, 31).unwrap().into());

        let begin = NaiveDate::from_ymd_opt(2024, 1, 7).unwrap().into();
        let end = NaiveDate::from_ymd_opt(2024, 1, 31).unwrap().into();

        let the_best = too_old
            .clone()
            .search_window_begin(begin)
            .search_window_end(end);

        for changeset in [too_old, too_young.clone(), the_best, too_young] {
            changeset
                .create(db_pool.get_ok().deref_mut())
                .await
                .expect("Failed to create search environment");
        }

        let result = StdcmSearchEnvironment::retrieve_latest(db_pool.get_ok().deref_mut())
            .await
            .expect("Failed to retrieve latest search environment");

        assert_eq!(result.search_window_begin, begin);
        assert_eq!(result.search_window_end, end);
    }

    #[rstest]
    async fn test_retrieve_latest_empty() {
        let db_pool = DbConnectionPoolV2::for_tests();
        let result = StdcmSearchEnvironment::retrieve_latest(db_pool.get_ok().deref_mut()).await;

        assert_eq!(result, None);
    }
}