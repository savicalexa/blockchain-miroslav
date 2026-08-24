import { expect } from "chai";
import hre from "hardhat";

const { ethers } = await hre.network.create();

describe("EventManager", function () {
  async function deployFixture() {
    const [organizer, otherAccount, thirdAccount] = await ethers.getSigners();
    const contract = await ethers.deployContract("EventManager");
    await contract.waitForDeployment();

    const latestBlock = await ethers.provider.getBlock("latest");
    const futureDate = BigInt((latestBlock?.timestamp ?? 0) + 86_400);

    return { contract, organizer, otherAccount, thirdAccount, futureDate };
  }

  it("creates and reads an event", async function () {
    const { contract, organizer, futureDate } = await deployFixture();

    await contract.createEvent(
      "Blockchain konferencija",
      "Novi Sad",
      futureDate,
      250n,
    );

    const eventItem = await contract.getFunction("getEvent")(1n);
    expect(eventItem.id).to.equal(1n);
    expect(eventItem.name).to.equal("Blockchain konferencija");
    expect(eventItem.location).to.equal("Novi Sad");
    expect(eventItem.capacity).to.equal(250n);
    expect(eventItem.registeredCount).to.equal(0n);
    expect(eventItem.organizer).to.equal(organizer.address);
    expect(eventItem.active).to.equal(true);
    expect(await contract.nextEventId()).to.equal(2n);
  });

  it("returns all events", async function () {
    const { contract, futureDate } = await deployFixture();

    await contract.createEvent("Prvi događaj", "Beograd", futureDate, 100n);
    await contract.createEvent("Drugi događaj", "Niš", futureDate + 1n, 80n);

    const events = await contract.getAllEvents();
    expect(events).to.have.length(2);
    expect(events[0].name).to.equal("Prvi događaj");
    expect(events[1].name).to.equal("Drugi događaj");
  });

  it("updates an event owned by the caller", async function () {
    const { contract, futureDate } = await deployFixture();

    await contract.createEvent("Stari naziv", "Beograd", futureDate, 50n);
    await contract.updateEvent(
      1n,
      "Novi naziv",
      "Kragujevac",
      futureDate + 3_600n,
      75n,
    );

    const eventItem = await contract.getFunction("getEvent")(1n);
    expect(eventItem.name).to.equal("Novi naziv");
    expect(eventItem.location).to.equal("Kragujevac");
    expect(eventItem.capacity).to.equal(75n);
    expect(eventItem.updatedAt).to.be.at.least(eventItem.createdAt);
  });

  it("prevents another wallet from updating an event", async function () {
    const { contract, otherAccount, futureDate } = await deployFixture();
    await contract.createEvent("Privatni događaj", "Subotica", futureDate, 20n);

    let reverted = false;
    try {
      await contract
        .connect(otherAccount)
        .updateEvent(1n, "Napad", "Nepoznato", futureDate + 10n, 1n);
    } catch (error) {
      reverted = String(error).includes("NotOrganizer");
    }

    expect(reverted).to.equal(true);
  });

  it("logically deletes an event and excludes it from active events", async function () {
    const { contract, futureDate } = await deployFixture();
    await contract.createEvent("Za brisanje", "Zrenjanin", futureDate, 40n);

    await contract.deleteEvent(1n);

    const deletedEvent = await contract.getFunction("getEvent")(1n);
    const activeEvents = await contract.getActiveEvents();
    const allEvents = await contract.getAllEvents();
    expect(deletedEvent.active).to.equal(false);
    expect(activeEvents).to.have.length(0);
    expect(allEvents).to.have.length(1);
  });

  it("returns events created by a selected organizer", async function () {
    const { contract, otherAccount, futureDate } = await deployFixture();
    await contract.createEvent("Moj događaj", "Beograd", futureDate, 100n);
    await contract
      .connect(otherAccount)
      .createEvent("Tuđi događaj", "Novi Sad", futureDate + 1n, 100n);

    const organizerEvents = await contract.getEventsByOrganizer(
      otherAccount.address,
    );
    expect(organizerEvents).to.have.length(1);
    expect(organizerEvents[0].name).to.equal("Tuđi događaj");
  });

  it("registers a wallet and updates the occupied capacity", async function () {
    const { contract, otherAccount, futureDate } = await deployFixture();
    await contract.createEvent("Web3 radionica", "Novi Sad", futureDate, 2n);

    await contract.connect(otherAccount).registerForEvent(1n);

    const eventItem = await contract.getFunction("getEvent")(1n);
    expect(eventItem.registeredCount).to.equal(1n);
    expect(await contract.isRegistered(1n, otherAccount.address)).to.equal(true);
  });

  it("prevents duplicate registrations and registrations over capacity", async function () {
    const { contract, otherAccount, thirdAccount, futureDate } =
      await deployFixture();
    await contract.createEvent("Mali meetup", "Beograd", futureDate, 1n);
    await contract.connect(otherAccount).registerForEvent(1n);

    let duplicateRejected = false;
    let fullEventRejected = false;
    try {
      await contract.connect(otherAccount).registerForEvent(1n);
    } catch (error) {
      duplicateRejected = String(error).includes("AlreadyRegistered");
    }
    try {
      await contract.connect(thirdAccount).registerForEvent(1n);
    } catch (error) {
      fullEventRejected = String(error).includes("EventFull");
    }

    expect(duplicateRejected).to.equal(true);
    expect(fullEventRejected).to.equal(true);
  });

  it("cancels a registration and releases a place", async function () {
    const { contract, otherAccount, futureDate } = await deployFixture();
    await contract.createEvent("Konferencija", "Niš", futureDate, 10n);
    await contract.connect(otherAccount).registerForEvent(1n);

    await contract.connect(otherAccount).cancelRegistration(1n);

    const eventItem = await contract.getFunction("getEvent")(1n);
    expect(eventItem.registeredCount).to.equal(0n);
    expect(await contract.isRegistered(1n, otherAccount.address)).to.equal(false);
  });

  it("prevents an organizer from reserving a place on their own event", async function () {
    const { contract, futureDate } = await deployFixture();
    await contract.createEvent("Organizatorski događaj", "Subotica", futureDate, 5n);

    let rejected = false;
    try {
      await contract.registerForEvent(1n);
    } catch (error) {
      rejected = String(error).includes("OrganizerCannotRegister");
    }

    expect(rejected).to.equal(true);
  });

  it("does not allow capacity to be reduced below existing registrations", async function () {
    const { contract, otherAccount, thirdAccount, futureDate } =
      await deployFixture();
    await contract.createEvent("Popularni događaj", "Beograd", futureDate, 3n);
    await contract.connect(otherAccount).registerForEvent(1n);
    await contract.connect(thirdAccount).registerForEvent(1n);

    let rejected = false;
    try {
      await contract.updateEvent(
        1n,
        "Popularni događaj",
        "Beograd",
        futureDate + 60n,
        1n,
      );
    } catch (error) {
      rejected = String(error).includes("CapacityBelowRegistrations");
    }

    expect(rejected).to.equal(true);
  });

  it("rejects invalid event data", async function () {
    const { contract, futureDate } = await deployFixture();

    let emptyFieldRejected = false;
    let capacityRejected = false;

    try {
      await contract.createEvent("", "Beograd", futureDate, 10n);
    } catch (error) {
      emptyFieldRejected = String(error).includes("EmptyField");
    }
    try {
      await contract.createEvent("Naziv", "Beograd", futureDate, 0n);
    } catch (error) {
      capacityRejected = String(error).includes("InvalidCapacity");
    }

    expect(emptyFieldRejected).to.equal(true);
    expect(capacityRejected).to.equal(true);
  });
});
