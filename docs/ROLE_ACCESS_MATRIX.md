# Role Access Matrix

| Capability | Student | Faculty / HOD | Admin |
|---|---:|---:|---:|
| Own attendance and report | Yes | No | No |
| Student directory and department records | No | Own department | All departments |
| Consolidated Dashboard | No | Own department | All departments |
| Consolidated API | 403 | Yes | Yes |
| Company administration | No | No | Yes |

The frontend also redirects a student who reaches the `consolidate` view state back to the student home. Backend authorization remains authoritative.
