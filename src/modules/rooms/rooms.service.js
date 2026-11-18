function createRoomsService(repository, buildingRepository) {
  return {
    list: () => repository.findAll(),
    get: (id) => repository.findById(id),
    create: async (data) => {
      const { NotFoundError } = require('../../errors/app-error');
      if (!(await buildingRepository.findById(data.buildingId))) {
        throw new NotFoundError('Building not found', 'BUILDING_NOT_FOUND');
      }
      return repository.create(data);
    },
  };
}

module.exports = { createRoomsService };
