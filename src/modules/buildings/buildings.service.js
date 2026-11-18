function createBuildingsService(repository) {
  return {
    list: () => repository.findAll(),
    get: (id) => repository.findById(id),
    rooms: async (id) => {
      const { NotFoundError } = require('../../errors/app-error');
      if (!(await repository.findById(id))) throw new NotFoundError('Building not found', 'BUILDING_NOT_FOUND');
      return repository.findRooms(id);
    },
    create: (data) => repository.create({ ...data, createdAt: new Date().toISOString() }),
  };
}

module.exports = { createBuildingsService };
