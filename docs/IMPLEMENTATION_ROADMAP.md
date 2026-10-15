# Implementation Roadmap

1. Reconcile the live SQL Server schema without deleting data, then run API integration tests against it.
2. Complete frontend responsive-layout refactoring and add component tests.
3. Remove the obsolete consolidated upload action or replace it with a role-appropriate document workflow.
4. Add an idempotent migration and preflight check that fails clearly when ORM-required columns are missing.
