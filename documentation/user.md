## User Field Documentation

Breinify supports various user properties that you can include in the analytics.

### Example of different user info

```javascript
var user1 = {
    'email' : 'johndoe@gmail.com'
};

var user2 = {
    'firstName' : 'John',
    'lastName' : 'Doe',
    'dateOfBirth' : new Date(88387200 * 1000);
};

var user3 = {
    'md5Email' : '761cd16b141770ecb0bbb8a4e5962d16'
};

var user4 = {
    'deviceId' : 'AAAAAAAAA-BBBB-CCCC-1111-222222220000'
};

/*
 * A user can contain additional information, which may be relevant for the end-point called,
 * e.g., the result of temporalData may enhance if a longitute and latitude is passed.
 */
var user4 = {
    'additional': {
      'location': {
        'latitude': 37.323,
        'longitude': -122.0322
      }
    }
};
```

### Fields

#### Email

Attribute key: `email`

Example value: `johndoe@gmail.com`

Description: The email address of the current user, if known.

#### First Name

Attribute key: `firstName`

Example value: `John`

Description: The first name of the current user, if known.

#### Last Name

Attribute String: `lastName`

Example: `Doe`

Description: The last name of the current user, if known.

#### Date of Birth

Attribute key: `dateOfBirth`

Example value: `new Date(1985, 6, 30)`

Description: The email address of the current user, if known.

#### Device ID

Attribute key: `deviceId`

Example value: `AAAAAAAAA-BBBB-CCCC-1111-222222220000`

Description: The current user's device's id, if known.

#### MD5 Email

Attribute key: `md5Email`

Example value: `761cd16b141770ecb0bbb8a4e5962d16`

Description: A hashed version of the user's email address.


#### Session ID

Attribute key: `sessionId`

Example value: `SID:ANON:w3.org:j6oAOxCWZ`

Description: The user's [Session Id](https://en.wikipedia.org/wiki/Session_ID).

#### additional Information

Attribute key: `additional`

Example values:

```
var additional1 = {
    'location': {
        'latitude': 37.323,
        'longitude': -122.0322
    }
};

var additional2 = {
    'location': {
        'city': 'Cupertino',
        'state': 'California',
        'country': 'US'
    }
};
```

Description: The user's [Session Id](https://en.wikipedia.org/wiki/Session_ID).
