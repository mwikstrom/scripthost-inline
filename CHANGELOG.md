## 1.3.0 - 2023-06-02

- New feature: Customizable message id prefix

## 1.2.0 - 2023-05-22

- New feature: Read-only globals

## 1.1.0 - 2022-07-08

- *Gracefully clone* script results and function call arguments.
- Re-throw first exception when all notified listeners fail.

The idea of cloning gracefully is to use the structured clone algorithm with the following behavior:

- Any exception from the structured clone algorithm should be detected early (before sending data over the wire)
- Promises are awaited and their result is then gracefully cloned
- Each element in an array is gracefully cloned
- Each value in a record object is gracefully cloned

## 1.0.0 - 2022-05-04

The first non-preview/development release.
