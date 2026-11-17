## User Field Documentation

Pass user information as a plain object to methods such as `Breinify.activity` and `Breinify.temporalData`.
The fields below are supported by `Breinify.BreinifyUser`; unknown top-level fields throw an error.
Put custom metadata inside `additional`.

### Examples

Each object is an independent example. Combine known fields in one object when appropriate.

```javascript
const emailUser = {
    email: 'johndoe@gmail.com'
};

const namedUser = {
    firstName: 'John',
    lastName: 'Doe',
    dateOfBirth: '07/30/1985'
};

const hashedUser = {
    md5Email: Breinify.UTL.md5('johndoe@gmail.com')
};

const deviceUser = {
    deviceId: 'AAAAAAAA-BBBB-CCCC-1111-222222220000'
};

// provide location context for temporal-data requests
const locationUser = {
    additional: {
        location: {
            latitude: 37.323,
            longitude: -122.0322
        }
    }
};

Breinify.temporalData(locationUser, false, (data, error) => {
    if (error) {
        console.error(error, data);
        return;
    }
    console.log(data);
});
```

### Fields

These examples describe the values to supply. Except for the structure of `additional`, the browser library
primarily checks field names rather than enforcing each field's type or format.

| Attribute key | Example value | Description |
| --- | --- | --- |
| `email` | `'johndoe@gmail.com'` | The user's email address. Setting a nonempty email also computes `md5Email`. |
| `emails` | `['johndoe@gmail.com', 'john@example.com']` | Additional email addresses associated with the user. |
| `firstName` | `'John'` | The user's first name. |
| `lastName` | `'Doe'` | The user's last name. |
| `dateOfBirth` | `'07/30/1985'` | The user's date of birth. Use a date string; repository examples use `MM/DD/YYYY`. The library does not parse or validate this format. |
| `deviceId` | `'AAAAAAAA-BBBB-CCCC-1111-222222220000'` | An identifier for the user's device. |
| `md5Email` | `Breinify.UTL.md5('johndoe@gmail.com')` | The MD5 hash of an email address. When `email` is present, its computed hash takes precedence. The library hashes the supplied string without trimming or lowercasing it. |
| `sessionId` | `'SID:ANON:example.com:j6oAOxCWZ'` | The current session identifier. API request helpers supply one automatically when it is not overridden. |
| `sessionIds` | `['previous-session-id']` | Other session identifiers associated with the user. |
| `phone` | `'+14155550123'` | The user's phone number. |
| `userId` | `'customer-123'` | Your application’s user identifier. |
| `userIds` | `['customer-123', 'loyalty-456']` | Other user identifiers associated with the user. |
| `twitterId` | `'123456789'` | The user's Twitter identifier. |
| `additional` | `{location: {latitude: 37.323, longitude: -122.0322}}` | A plain object containing location context and other metadata. Nested objects are allowed. |

Pass a date string rather than a JavaScript `Date` object. The current user setter treats objects without
enumerable properties, including ordinary `Date` instances, as empty and removes the field. It does not
convert a `Date` into a birthday string.

### Additional information

These objects are values for the user's `additional` field, not standalone user objects:

```javascript
const coordinateInfo = {
    location: {
        latitude: 37.323,
        longitude: -122.0322
    }
};

const addressInfo = {
    location: {
        city: 'Cupertino',
        state: 'California',
        country: 'US'
    }
};

const user = {
    email: 'johndoe@gmail.com',
    additional: coordinateInfo
};
```

When creating a user, the library fills missing browser context in `additional`, including `userAgent`,
`referrer` (when available), `url`, `timezone` (when available), and `localDateTime`. Request helpers also
add session and browser identifiers. An empty object `{}` can therefore be used for an anonymous request.

For asynchronous user creation, if numeric latitude and longitude are missing, the library may attempt
browser geolocation only when the browser's Permissions API reports that permission is already granted.
It does not prompt for location permission. Supply coordinates explicitly when the request needs a known location.
