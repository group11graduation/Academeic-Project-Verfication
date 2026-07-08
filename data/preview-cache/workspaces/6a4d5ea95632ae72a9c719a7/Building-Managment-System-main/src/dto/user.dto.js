/**
 * Data Transfer Objects for User entities
 * Used to format user data for API responses
 */

class UserResponseDTO {
    constructor(user) {
        this.id = user._id;
        this.name = user.name;
        this.email = user.email;
        this.role = user.role;
        this.phone = user.phone;
        this.buildingLogo = user.buildingLogo;
        this.paymentDetails = user.paymentDetails;
        this.sections = user.sections;
        this.building = user.building;
        // Include adminPerson if populated
        this.adminPerson = user.adminPerson ? {
            id: user.adminPerson._id,
            name: user.adminPerson.name,
            email: user.adminPerson.email,
            phone: user.adminPerson.phone
        } : null;
        this.createdAt = user.createdAt;
        this.updatedAt = user.updatedAt;
        // Explicitly exclude password
    }
}

class UserListDTO {
    constructor(users) {
        return users.map(user => {
            const dto = new UserResponseDTO(user);
            // Include buildingLogo in list for manager images (needed for display)
            // Keep hasLogo flag for backward compatibility
            dto.hasLogo = !!user.buildingLogo;
            // buildingLogo is already included from UserResponseDTO
            return dto;
        });
    }
}

class UserProfileDTO {
    constructor(user) {
        this.id = user._id;
        this.name = user.name;
        this.email = user.email;
        this.role = user.role;
        this.building = user.building ? {
            id: user.building._id,
            name: user.building.name,
            location: user.building.location
        } : null;
    }
}

module.exports = {
    UserResponseDTO,
    UserListDTO,
    UserProfileDTO
};
