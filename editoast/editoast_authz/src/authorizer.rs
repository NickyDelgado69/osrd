use std::{collections::HashSet, future::Future};

use tracing::debug;

use crate::roles::{BuiltinRoleSet, RoleConfig};

pub type UserIdentity = String;
pub type UserName = String;

#[derive(Debug)]
pub struct UserInfo {
    pub identity: UserIdentity,
    pub name: UserName,
}

pub struct Authorizer<'config, S: StorageDriver> {
    user: UserInfo,
    user_id: i64,
    roles_config: &'config RoleConfig<S::BuiltinRole>,
    user_roles: Option<HashSet<S::BuiltinRole>>,
    storage: S,
}

pub trait StorageDriver {
    type BuiltinRole: BuiltinRoleSet + std::fmt::Debug;
    type Error: std::error::Error;

    fn ensure_user(&self, user: &UserInfo)
        -> impl Future<Output = Result<i64, Self::Error>> + Send;

    fn fetch_subject_roles(
        &self,
        subject_id: i64,
        roles_config: &RoleConfig<Self::BuiltinRole>,
    ) -> impl Future<Output = Result<HashSet<Self::BuiltinRole>, Self::Error>> + Send;

    fn ensure_subject_roles(
        &self,
        subject_id: i64,
        roles_config: &RoleConfig<Self::BuiltinRole>,
        roles: HashSet<Self::BuiltinRole>,
    ) -> impl Future<Output = Result<(), Self::Error>> + Send;

    fn remove_subject_roles(
        &self,
        subject_id: i64,
        roles_config: &RoleConfig<Self::BuiltinRole>,
        roles: HashSet<Self::BuiltinRole>,
    ) -> impl Future<Output = Result<HashSet<Self::BuiltinRole>, Self::Error>> + Send;
}

impl<'config, S: StorageDriver> Authorizer<'config, S> {
    pub async fn try_initialize(
        user: UserInfo,
        roles_config: &'config RoleConfig<S::BuiltinRole>,
        storage_driver: S,
    ) -> Result<Self, S::Error> {
        let user_id = storage_driver.ensure_user(&user).await?;
        debug!(%user, %user_id, "user authenticated");
        Ok(Self {
            user,
            user_id,
            roles_config,
            user_roles: None,
            storage: storage_driver,
        })
    }

    pub fn new_superuser(
        roles_config: &'config RoleConfig<S::BuiltinRole>,
        storage_driver: S,
    ) -> Self {
        debug_assert!(
            roles_config.is_superuser(),
            "Authorizer::new_superuser requires a superuser role config"
        );
        Self {
            user: UserInfo {
                identity: "superuser".to_string(),
                name: "Super User".to_string(),
            },
            user_id: -1,
            roles_config,
            user_roles: None,
            storage: storage_driver,
        }
    }

    pub fn is_superuser(&self) -> bool {
        self.roles_config.is_superuser()
    }

    /// Check that the user has all the required builting roles
    #[tracing::instrument(skip_all, fields(user = %self.user, user_roles = ?self.user_roles, ?required_roles), ret, err)]
    pub async fn check_roles(
        &mut self,
        required_roles: HashSet<S::BuiltinRole>,
    ) -> Result<bool, S::Error> {
        if self.is_superuser() {
            tracing::debug!("role checking skipped for superuser");
            return Ok(true);
        }

        let user_roles = self.get_user_roles().await?;
        Ok(required_roles.is_subset(user_roles))
    }

    async fn get_user_roles(&mut self) -> Result<&HashSet<S::BuiltinRole>, S::Error> {
        match self.user_roles {
            None => {
                tracing::info!("fetching user roles");
                let user_roles = self
                    .storage
                    .fetch_subject_roles(self.user_id, self.roles_config)
                    .await?;
                tracing::debug!(roles = ?user_roles, "caching user roles");
                Ok(self.user_roles.insert(user_roles))
            }
            Some(ref user_roles) => Ok(user_roles),
        }
    }
}

impl<'config, S: StorageDriver> std::fmt::Debug for Authorizer<'config, S> {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("Authorizer")
            .field("user", &self.user)
            .field("user_id", &self.user_id)
            .field("roles_config", &self.roles_config)
            .field("user_roles", &self.user_roles)
            .finish()
    }
}

impl std::fmt::Display for UserInfo {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{} ({})", self.identity, self.name)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::fixtures::*;
    use pretty_assertions::assert_eq;
    use std::{
        borrow::BorrowMut,
        collections::HashMap,
        convert::Infallible,
        sync::{Arc, Mutex},
    };

    #[derive(Debug, Clone, Default)]
    struct MockStorageDriver {
        users: Arc<Mutex<HashMap<UserIdentity, i64>>>,
        user_roles: Arc<Mutex<HashMap<i64, HashSet<TestBuiltinRole>>>>,
    }

    #[tokio::test]
    async fn superuser() {
        let config = RoleConfig::new_superuser();
        let storage = MockStorageDriver::default();
        let mut authorizer = Authorizer::new_superuser(&config, storage);
        assert!(authorizer.is_superuser());
        // Check that the superuser has any role even if not explicitely granted
        assert_eq!(
            authorizer
                .check_roles(HashSet::from([TestBuiltinRole::UserBan]))
                .await,
            Ok(true)
        );
    }

    #[tokio::test]
    async fn check_roles() {
        let config = default_test_config();
        let storage = MockStorageDriver::default();
        let mut authorizer = Authorizer::try_initialize(
            UserInfo {
                identity: "toto".to_owned(),
                name: "Sir Toto, the One and Only".to_owned(),
            },
            &config,
            storage,
        )
        .await
        .unwrap();

        {
            let users = authorizer.storage.users.lock().unwrap();
            assert_eq!(
                users.iter().next(),
                Some((&"toto".to_owned(), &0)),
                "new user should have been created"
            );
        }

        // insert some mocked roles
        {
            let mut user_roles = authorizer.storage.user_roles.lock().unwrap();
            user_roles.insert(
                0,
                HashSet::from([
                    TestBuiltinRole::DocRead,
                    TestBuiltinRole::UserAdd,
                    TestBuiltinRole::UserBan,
                ]),
            );
        }

        assert!(authorizer
            .check_roles(HashSet::from([TestBuiltinRole::DocRead]))
            .await
            .unwrap());
        assert!(authorizer
            .check_roles(HashSet::from([
                TestBuiltinRole::UserAdd,
                TestBuiltinRole::UserBan
            ]))
            .await
            .unwrap());
        assert!(authorizer
            .check_roles(HashSet::from([
                TestBuiltinRole::DocRead,
                TestBuiltinRole::UserAdd,
                TestBuiltinRole::UserBan
            ]))
            .await
            .unwrap());

        assert!(!authorizer
            .check_roles(HashSet::from([TestBuiltinRole::DocEdit,]))
            .await
            .unwrap());
        assert!(!authorizer
            .check_roles(HashSet::from([
                TestBuiltinRole::DocRead,
                TestBuiltinRole::DocDelete,
            ]))
            .await
            .unwrap());

        assert!(authorizer.check_roles(HashSet::from([])).await.unwrap());
    }

    impl StorageDriver for MockStorageDriver {
        type BuiltinRole = TestBuiltinRole;
        type Error = Infallible;

        async fn ensure_user(&self, user: &UserInfo) -> Result<i64, Self::Error> {
            let mut users = self.users.lock().unwrap();
            let next_id = users.len() as i64;
            let user_id = users.entry(user.identity.clone()).or_insert(next_id);
            Ok(*user_id)
        }

        async fn fetch_subject_roles(
            &self,
            subject_id: i64,
            _roles_config: &RoleConfig<Self::BuiltinRole>,
        ) -> Result<HashSet<Self::BuiltinRole>, Self::Error> {
            let user_roles = self.user_roles.lock().unwrap();
            let roles = user_roles.get(&subject_id).cloned().expect("no user");
            Ok(roles)
        }

        async fn ensure_subject_roles(
            &self,
            subject_id: i64,
            _roles_config: &RoleConfig<Self::BuiltinRole>,
            roles: HashSet<Self::BuiltinRole>,
        ) -> Result<(), Self::Error> {
            let mut user_roles = self.user_roles.lock().unwrap();
            user_roles.entry(subject_id).or_default().extend(roles);
            Ok(())
        }

        async fn remove_subject_roles(
            &self,
            subject_id: i64,
            _roles_config: &RoleConfig<Self::BuiltinRole>,
            roles: HashSet<Self::BuiltinRole>,
        ) -> Result<HashSet<Self::BuiltinRole>, Self::Error> {
            let mut user_roles = self.user_roles.lock().unwrap();
            let user_roles = user_roles.entry(subject_id).or_default();
            let removed_roles = roles
                .iter()
                .filter(|role| user_roles.remove(*role))
                .cloned()
                .collect();
            Ok(removed_roles)
        }
    }
}