function createAuthController(service) {
  return {
    register: async (req, res) => {
      const user = await service.register(req.validated.body);
      return res.status(201).json(user);
    },
    login: async (req, res) => res.json(await service.login(req.validated.body)),
    me: async (req, res) => res.json(await service.me(req.user.id)),
  };
}

module.exports = { createAuthController };
