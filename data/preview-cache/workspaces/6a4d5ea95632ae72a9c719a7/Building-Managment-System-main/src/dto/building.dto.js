/**
 * Data Transfer Objects for Building entities
 */

class BuildingResponseDTO {
    constructor(building) {
        this.id = building._id;
        this.name = building.name;
        this.brandingName = building.brandingName;
        this.brandingLogo = building.brandingLogo;
        this.location = building.location;
        this.approvalPolicy = building.approvalPolicy;
        this.floorLimit = building.floorLimit;
        this.allowedRoomTypes = building.allowedRoomTypes;
        this.manager = building.manager ? {
            id: building.manager._id,
            name: building.manager.name,
            email: building.manager.email
        } : null;
        this.createdAt = building.createdAt;
        this.updatedAt = building.updatedAt;
    }
}

class BuildingListDTO {
    constructor(buildings) {
        return buildings.map(building => new BuildingResponseDTO(building));
    }
}

module.exports = {
    BuildingResponseDTO,
    BuildingListDTO
};
