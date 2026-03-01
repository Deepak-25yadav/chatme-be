# Postman Testing Guide - Signup & Login Flow

## Base URL
```
http://localhost:3000
```
*(Replace with your actual server URL if different)*

---

## 1. SIGNUP ENDPOINT

### Request Details
- **Method:** `POST`
- **URL:** `http://localhost:3000/api/auth/signup`
- **Headers:**
  ```
  Content-Type: application/json
  ```

### Request Body (JSON)
```json
{
  "name": "John Doe",
  "email": "john.doe@example.com",
  "password": "password123",
  "role": "user"
}
```

### Field Requirements:
- **name** (required): String, 2-50 characters
- **email** (required): Valid email format
- **password** (required): Minimum 6 characters
- **role** (optional): Either `"admin"` or `"user"`. Defaults to `"user"` if not provided
  - **Note:** Only one admin account is allowed. If trying to register as admin when one already exists, you'll get an error.

### Success Response (201 Created)
```json
{
  "message": "User registered successfully",
  "user": {
    "userId": "550e8400-e29b-41d4-a716-446655440000",
    "name": "John Doe",
    "email": "john.doe@example.com",
    "role": "user",
    "avatar": "https://ui-avatars.com/api/?name=John%20Doe&background=random"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### Error Responses:

**400 Bad Request - Missing Fields:**
```json
{
  "error": "Name, email, and password are required"
}
```

**400 Bad Request - Invalid Email:**
```json
{
  "error": "Invalid email format"
}
```

**400 Bad Request - Password Too Short:**
```json
{
  "error": "Password must be at least 6 characters long"
}
```

**400 Bad Request - Email Already Exists:**
```json
{
  "error": "Email already registered"
}
```

**400 Bad Request - Admin Already Exists:**
```json
{
  "error": "Admin account already exists. Only one admin is allowed."
}
```

**500 Internal Server Error:**
```json
{
  "error": "Failed to register user"
}
```

---

## 2. LOGIN ENDPOINT

### Request Details
- **Method:** `POST`
- **URL:** `http://localhost:3000/api/auth/login`
- **Headers:**
  ```
  Content-Type: application/json
  ```

### Request Body (JSON)
```json
{
  "email": "john.doe@example.com",
  "password": "password123"
}
```

### Field Requirements:
- **email** (required): Valid email format
- **password** (required): User's password

### Success Response (200 OK)
```json
{
  "message": "Login successful",
  "user": {
    "userId": "550e8400-e29b-41d4-a716-446655440000",
    "name": "John Doe",
    "email": "john.doe@example.com",
    "role": "user",
    "avatar": "https://ui-avatars.com/api/?name=John%20Doe&background=random",
    "isOnline": false,
    "lastSeen": "2024-01-15T10:30:00.000Z"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### Error Responses:

**400 Bad Request - Missing Fields:**
```json
{
  "error": "Email and password are required"
}
```

**401 Unauthorized - Invalid Credentials:**
```json
{
  "error": "Invalid email or password"
}
```

**500 Internal Server Error:**
```json
{
  "error": "Failed to login"
}
```

---

## 3. ADDITIONAL AUTH ENDPOINTS

### Get Current User (Protected)
- **Method:** `GET`
- **URL:** `http://localhost:3000/api/auth/me`
- **Headers:**
  ```
  Content-Type: application/json
  Authorization: Bearer <token>
  ```
- **Description:** Get current authenticated user's information
- **Response:** Same as login user object

### Logout (Protected)
- **Method:** `POST`
- **URL:** `http://localhost:3000/api/auth/logout`
- **Headers:**
  ```
  Content-Type: application/json
  Authorization: Bearer <token>
  ```
- **Request Body:** None
- **Success Response:**
```json
{
  "message": "Logout successful"
}
```

### Refresh Token
- **Method:** `POST`
- **URL:** `http://localhost:3000/api/auth/refresh`
- **Headers:**
  ```
  Content-Type: application/json
  ```
- **Request Body:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```
- **Success Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

---

## Testing Flow Example

### Step 1: Signup
1. Create a new POST request to `http://localhost:3000/api/auth/signup`
2. Set header `Content-Type: application/json`
3. Add body:
   ```json
   {
     "name": "Test User",
     "email": "test@example.com",
     "password": "test123",
     "role": "user"
   }
   ```
4. Send request
5. **Save the `token` and `refreshToken` from response** for subsequent requests

### Step 2: Login
1. Create a new POST request to `http://localhost:3000/api/auth/login`
2. Set header `Content-Type: application/json`
3. Add body:
   ```json
   {
     "email": "test@example.com",
     "password": "test123"
   }
   ```
4. Send request
5. **Save the `token` and `refreshToken` from response**

### Step 3: Get Current User (Optional)
1. Create a new GET request to `http://localhost:3000/api/auth/me`
2. Set header `Authorization: Bearer <token_from_step_2>`
3. Send request

### Step 4: Logout (Optional)
1. Create a new POST request to `http://localhost:3000/api/auth/logout`
2. Set header `Authorization: Bearer <token_from_step_2>`
3. Send request

---

## Postman Collection Setup Tips

1. **Create Environment Variables:**
   - `base_url`: `http://localhost:3000`
   - `token`: (will be set automatically after login)
   - `refreshToken`: (will be set automatically after login)

2. **Use Tests Tab to Auto-Save Tokens:**
   ```javascript
   // In Login/Signup request Tests tab:
   if (pm.response.code === 200 || pm.response.code === 201) {
       const jsonData = pm.response.json();
       pm.environment.set("token", jsonData.token);
       pm.environment.set("refreshToken", jsonData.refreshToken);
   }
   ```

3. **Use Variables in Authorization Header:**
   - For protected endpoints, use: `Bearer {{token}}`

4. **Test Different Scenarios:**
   - Valid signup
   - Duplicate email signup
   - Invalid email format
   - Short password (< 6 chars)
   - Valid login
   - Invalid credentials login
   - Missing fields


