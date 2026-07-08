/**
 * Data Transfer Objects for Maintenance entities
 */

class MaintenanceResponseDTO {
    constructor(maintenance) {
        this.id = maintenance._id;
        this.title = maintenance.title;
        this.description = maintenance.description;
        this.status = maintenance.status;
        this.priority = maintenance.priority;
        this.building = maintenance.building ? {
            id: maintenance.building._id,
            name: maintenance.building.name
        } : null;
        this.floor = maintenance.floor ? {
            id: maintenance.floor._id,
            floorNumber: maintenance.floor.floorNumber
        } : null;
        this.room = maintenance.room ? {
            id: maintenance.room._id,
            roomNumber: maintenance.room.roomNumber,
            type: maintenance.room.type
        } : null;
        this.reportedBy = maintenance.reportedBy;
        this.assignedTo = maintenance.assignedTo ? {
            id: maintenance.assignedTo._id,
            name: maintenance.assignedTo.name
        } : null;
        this.createdAt = maintenance.createdAt;
        this.updatedAt = maintenance.updatedAt;
    }
}

class MaintenanceListDTO {
    constructor(maintenanceRequests) {
        return maintenanceRequests.map(req => new MaintenanceResponseDTO(req));
    }
}

module.exports = {
    MaintenanceResponseDTO,
    MaintenanceListDTO
};
