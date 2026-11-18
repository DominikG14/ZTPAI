module.exports = {
  openapi: '3.0.0',
  info: {
    title: 'Room Booking API',
    version: '1.0.0',
    description: 'API do zarządzania salami konferencyjnymi i rezerwacjami',
  },
  servers: [
    {
      url: '/',
      description: 'Aktualny serwer',
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
  },
  paths: {
    '/api/auth/register': {
      post: {
        summary: 'Rejestracja nowego użytkownika',
        tags: ['Auth'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string', minLength: 10 },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Użytkownik zarejestrowany' },
          409: { description: 'Email jest już zajęty' },
        },
      },
    },
    '/api/auth/login': {
      post: {
        summary: 'Logowanie użytkownika',
        tags: ['Auth'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string' },
                  password: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Zwraca accessToken' },
          401: { description: 'Niepoprawne dane uwierzytelniające' },
        },
      },
    },
    '/api/auth/me': {
      get: {
        summary: 'Pobranie profilu zalogowanego użytkownika',
        tags: ['Auth'],
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'Profil użytkownika' },
          401: { description: 'Brak lub niepoprawny token' },
        },
      },
    },
    '/api/buildings': {
      get: {
        summary: 'Lista budynków',
        tags: ['Buildings'],
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'Lista budynków wraz z liczbą sal' },
        },
      },
      post: {
        summary: 'Tworzenie budynku',
        tags: ['Buildings'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'address'],
                properties: {
                  name: { type: 'string' },
                  address: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Budynek utworzony' },
        },
      },
    },
    '/api/rooms': {
      get: {
        summary: 'Lista sal',
        tags: ['Rooms'],
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'Lista sal' },
        },
      },
      post: {
        summary: 'Tworzenie sali (wymaga roli ADMIN)',
        tags: ['Rooms'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['buildingId', 'name', 'capacity'],
                properties: {
                  buildingId: { type: 'integer' },
                  name: { type: 'string' },
                  capacity: { type: 'integer', minimum: 1 },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Sala utworzona' },
          403: { description: 'Wymagana rola ADMIN' },
        },
      },
    },
    '/api/reservations': {
      get: {
        summary: 'Lista rezerwacji z paginacją i filtrowaniem',
        tags: ['Reservations'],
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'roomId', in: 'query', schema: { type: 'integer' } },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
        ],
        responses: {
          200: { description: 'Lista rezerwacji i metadane paginacji' },
        },
      },
      post: {
        summary: 'Tworzenie rezerwacji',
        tags: ['Reservations'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['roomId', 'participants', 'startTime', 'endTime'],
                properties: {
                  roomId: { type: 'integer' },
                  participants: { type: 'integer', minimum: 1 },
                  startTime: { type: 'string', format: 'date-time' },
                  endTime: { type: 'string', format: 'date-time' },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Rezerwacja utworzona' },
          400: { description: 'Błąd walidacji' },
          409: { description: 'Kolizja rezerwacji lub przekroczona pojemność' },
        },
      },
    },
    '/api/reservations/{id}/cancel': {
      patch: {
        summary: 'Odwołanie rezerwacji',
        tags: ['Reservations'],
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' } },
        ],
        responses: {
          200: { description: 'Rezerwacja odwołana' },
          403: { description: 'Brak uprawnień do odwołania rezerwacji' },
          409: { description: 'Rezerwacja już rozpoczęta' },
        },
      },
    },
  },
};
