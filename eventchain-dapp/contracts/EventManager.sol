// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title EventManager
/// @notice Decentralized registry that supports CRUD operations for events.
/// @dev Deletion is logical because historical blockchain data is immutable.
contract EventManager {
    struct EventItem {
        uint256 id;
        string name;
        string location;
        uint256 date;
        uint256 capacity;
        uint256 registeredCount;
        address organizer;
        bool active;
        uint256 createdAt;
        uint256 updatedAt;
    }

    error EventDoesNotExist(uint256 id);
    error NotOrganizer(address caller);
    error EventAlreadyDeleted(uint256 id);
    error EmptyField();
    error TextTooLong();
    error InvalidEventDate();
    error InvalidCapacity();
    error AlreadyRegistered(uint256 id, address attendee);
    error NotRegistered(uint256 id, address attendee);
    error EventFull(uint256 id);
    error RegistrationClosed(uint256 id);
    error OrganizerCannotRegister(uint256 id);
    error CapacityBelowRegistrations(uint256 registeredCount);

    event EventCreated(
        uint256 indexed id,
        address indexed organizer,
        string name,
        uint256 date
    );
    event EventUpdated(uint256 indexed id, address indexed organizer);
    event EventDeleted(uint256 indexed id, address indexed organizer);
    event AttendeeRegistered(uint256 indexed id, address indexed attendee);
    event RegistrationCancelled(uint256 indexed id, address indexed attendee);

    uint256 public nextEventId = 1;
    mapping(uint256 => EventItem) private eventsById;
    mapping(uint256 => mapping(address => bool)) private registrations;

    modifier existingEvent(uint256 id) {
        if (eventsById[id].organizer == address(0)) {
            revert EventDoesNotExist(id);
        }
        _;
    }

    modifier onlyOrganizer(uint256 id) {
        if (eventsById[id].organizer != msg.sender) {
            revert NotOrganizer(msg.sender);
        }
        _;
    }

    modifier activeEvent(uint256 id) {
        if (!eventsById[id].active) {
            revert EventAlreadyDeleted(id);
        }
        _;
    }

    /// @notice Creates a new event owned by the transaction sender.
    function createEvent(
        string calldata name,
        string calldata location,
        uint256 date,
        uint256 capacity
    ) external returns (uint256 id) {
        _validateEvent(name, location, date, capacity);

        id = nextEventId;
        nextEventId++;

        eventsById[id] = EventItem({
            id: id,
            name: name,
            location: location,
            date: date,
            capacity: capacity,
            registeredCount: 0,
            organizer: msg.sender,
            active: true,
            createdAt: block.timestamp,
            updatedAt: block.timestamp
        });

        emit EventCreated(id, msg.sender, name, date);
    }

    /// @notice Returns one event, including a logically deleted event.
    function getEvent(uint256 id)
        external
        view
        existingEvent(id)
        returns (EventItem memory)
    {
        return eventsById[id];
    }

    /// @notice Returns every event, including inactive historical records.
    function getAllEvents() external view returns (EventItem[] memory result) {
        uint256 count = nextEventId - 1;
        result = new EventItem[](count);

        for (uint256 i = 0; i < count; i++) {
            result[i] = eventsById[i + 1];
        }
    }

    /// @notice Returns only currently active events.
    function getActiveEvents() external view returns (EventItem[] memory result) {
        uint256 count = nextEventId - 1;
        uint256 activeCount;

        for (uint256 i = 1; i <= count; i++) {
            if (eventsById[i].active) activeCount++;
        }

        result = new EventItem[](activeCount);
        uint256 resultIndex;

        for (uint256 i = 1; i <= count; i++) {
            if (eventsById[i].active) {
                result[resultIndex] = eventsById[i];
                resultIndex++;
            }
        }
    }

    /// @notice Returns every event created by the supplied wallet address.
    function getEventsByOrganizer(address organizer)
        external
        view
        returns (EventItem[] memory result)
    {
        uint256 count = nextEventId - 1;
        uint256 organizerEventCount;

        for (uint256 i = 1; i <= count; i++) {
            if (eventsById[i].organizer == organizer) organizerEventCount++;
        }

        result = new EventItem[](organizerEventCount);
        uint256 resultIndex;

        for (uint256 i = 1; i <= count; i++) {
            if (eventsById[i].organizer == organizer) {
                result[resultIndex] = eventsById[i];
                resultIndex++;
            }
        }
    }

    /// @notice Returns whether a wallet is registered for an event.
    function isRegistered(uint256 id, address attendee)
        external
        view
        existingEvent(id)
        returns (bool)
    {
        return registrations[id][attendee];
    }

    /// @notice Registers the caller while seats are available.
    function registerForEvent(uint256 id)
        external
        existingEvent(id)
        activeEvent(id)
    {
        EventItem storage eventItem = eventsById[id];
        if (block.timestamp >= eventItem.date) revert RegistrationClosed(id);
        if (msg.sender == eventItem.organizer) revert OrganizerCannotRegister(id);
        if (registrations[id][msg.sender]) {
            revert AlreadyRegistered(id, msg.sender);
        }
        if (eventItem.registeredCount >= eventItem.capacity) revert EventFull(id);

        registrations[id][msg.sender] = true;
        eventItem.registeredCount++;
        eventItem.updatedAt = block.timestamp;

        emit AttendeeRegistered(id, msg.sender);
    }

    /// @notice Cancels the caller's registration before the event starts.
    function cancelRegistration(uint256 id)
        external
        existingEvent(id)
        activeEvent(id)
    {
        EventItem storage eventItem = eventsById[id];
        if (block.timestamp >= eventItem.date) revert RegistrationClosed(id);
        if (!registrations[id][msg.sender]) {
            revert NotRegistered(id, msg.sender);
        }

        registrations[id][msg.sender] = false;
        eventItem.registeredCount--;
        eventItem.updatedAt = block.timestamp;

        emit RegistrationCancelled(id, msg.sender);
    }

    /// @notice Updates an active event. Only its organizer can call this.
    function updateEvent(
        uint256 id,
        string calldata name,
        string calldata location,
        uint256 date,
        uint256 capacity
    ) external existingEvent(id) onlyOrganizer(id) activeEvent(id) {
        _validateEvent(name, location, date, capacity);

        EventItem storage eventItem = eventsById[id];
        if (capacity < eventItem.registeredCount) {
            revert CapacityBelowRegistrations(eventItem.registeredCount);
        }
        eventItem.name = name;
        eventItem.location = location;
        eventItem.date = date;
        eventItem.capacity = capacity;
        eventItem.updatedAt = block.timestamp;

        emit EventUpdated(id, msg.sender);
    }

    /// @notice Logically deletes an event. Its data stays auditable on-chain.
    function deleteEvent(uint256 id)
        external
        existingEvent(id)
        onlyOrganizer(id)
        activeEvent(id)
    {
        eventsById[id].active = false;
        eventsById[id].updatedAt = block.timestamp;

        emit EventDeleted(id, msg.sender);
    }

    function _validateEvent(
        string calldata name,
        string calldata location,
        uint256 date,
        uint256 capacity
    ) private view {
        uint256 nameLength = bytes(name).length;
        uint256 locationLength = bytes(location).length;

        if (nameLength == 0 || locationLength == 0) revert EmptyField();
        if (nameLength > 80 || locationLength > 120) revert TextTooLong();
        if (date <= block.timestamp) revert InvalidEventDate();
        if (capacity == 0) revert InvalidCapacity();
    }
}
