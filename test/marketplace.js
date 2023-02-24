require("@openzeppelin/test-helpers/configure")({
  provider: web3.currentProvider,
  singletons: {
    abstraction: "truffle",
  },
});

const { balance, ether, expectRevert, expectEvent } = require('@openzeppelin/test-helpers');
const Marketplace = artifacts.require("Marketplace");
const BoredPetsNFT = artifacts.require("BoredPetsNFT");

function assertListing(actual, expected) {
  assert.equal(actual.nftContract, expected.nftContract, "NFT contract is not correct");
  assert.equal(actual.tokenId, expected.tokenId, "TokenId is not correct");
  assert.equal(actual.owner, expected.owner, "Owner is not correct");
  assert.equal(actual.seller, expected.seller, "Seller is not correct");
  assert.equal(actual.price, expected.price, "Price is not correct");
  assert.equal(actual.listed, expected.listed, "Listed is not correct")
}

function getListing(listings, tokenId) {
  let listing = {};
  listings.every((_listing) => {
    if (_listing.tokenId == tokenId) {
      listing = _listing;
      return false;
    } else {
      return true;
    }
  });
  return listing
}

function listingToString(listing) {
  let listingCopy = {...listing};
  listingCopy.tokenId = listing.tokenId.toString();
  listingCopy.price = listing.price.toString();
  if (listing.listed) {
    listingCopy.listed = listing.listed.toString();
  }
  return listingCopy;
}

async function mintNft(nftContract, tokenOwner) {
  return (await nftContract.mint("fakeURI", {from: tokenOwner})).logs[0].args.tokenId.toNumber()
}

contract("Marketplace", function (accounts) {
  const MARKETPLACE_OWNER = accounts[0];
  const TOKEN_OWNER = accounts[1];
  const BUYER = accounts[2];
  let marketplace;
  let boredPetsNFT;
  let nftContract;
  let listingFee;

  before('should reuse variables', async () => {
    marketplace = await Marketplace.deployed();
    boredPetsNFT = await BoredPetsNFT.deployed();
    nftContract = boredPetsNFT.address;
    listingFee = (await marketplace.LISTING_FEE()).toString();
    console.log("marketplace %s", marketplace.address)
    console.log("token_owner %s", TOKEN_OWNER)
    console.log("buyer %s", BUYER)
  });
  it("should validate before listing", async function () {
    await expectRevert(
      marketplace.listNft(nftContract, 1, ether(".005"), {from: TOKEN_OWNER}),
      "Not enough ether for listing fee"
    );
    await expectRevert(
      marketplace.listNft(nftContract, 1, 0, {from: TOKEN_OWNER, value: listingFee}),
      "Price must be at least 1 wei"
    );
  });
  it("should list nft", async function () {
    let tokenID = await mintNft(boredPetsNFT, TOKEN_OWNER);
    let tracker = await balance.tracker(MARKETPLACE_OWNER);
    await tracker.get();
    let txn = await marketplace.listNft(nftContract, tokenID, ether(".005"), {from: TOKEN_OWNER, value: listingFee});
    assert.equal(await tracker.delta(), listingFee, "Listing fee not transferred");
    let expectedListing = {
      nftContract: nftContract,
      tokenId: tokenID,
      seller: TOKEN_OWNER,
      owner: marketplace.address,
      price: ether(".005"),
      listed: true
    };
    assertListing(getListing(await marketplace.getListedNfts(), tokenID), expectedListing);
    assertListing(getListing(await marketplace.getMyListedNfts({from: TOKEN_OWNER}), tokenID), expectedListing);
    delete expectedListing.listed;
    expectEvent(txn, "NFTListed", listingToString(expectedListing));
  });
  it("should validate before buying", async function () {
    await expectRevert(
      marketplace.buyNft(nftContract, 1, {from: BUYER}),
      "Not enough ether to cover asking price"
    );
  });
  it("should modify listings when nft is bought", async function () {
    let tokenID = await mintNft(boredPetsNFT, TOKEN_OWNER);
    await marketplace.listNft(nftContract, tokenID, ether(".005"), {from: TOKEN_OWNER, value: listingFee});
    let expectedListing = {
      nftContract: nftContract,
      tokenId: tokenID,
      seller: TOKEN_OWNER,
      owner: marketplace.address,
      price: ether(".005"),
      listed: true
    };
    assertListing(getListing(await marketplace.getListedNfts(), tokenID), expectedListing);
    let tracker = await balance.tracker(TOKEN_OWNER);
    let txn = await marketplace.buyNft(nftContract, tokenID, {from: BUYER, value: ether(".005")});
    expectedListing.owner = BUYER;
    expectedListing.listed = false;
    assert.equal((await tracker.delta()).toString(), ether(".005").toString(), "Price not paid to seller");
    assertListing(getListing(await marketplace.getMyNfts({from: BUYER}), tokenID), expectedListing);
    delete expectedListing.listed;
    expectEvent(txn, "NFTSold", listingToString(expectedListing));
  });
  it("should validate reselling", async function () {
    await expectRevert(
      marketplace.resellNft(nftContract, 1, 0, {from: BUYER, value: listingFee}),
      "Price must be at least 1 wei"
    );
    await expectRevert(
      marketplace.resellNft(nftContract, 1, ether(".005"), {from: BUYER}),
      "Not enough ether for listing fee"
    );
  });
  it("should resell nft", async function () {
    let tokenID = await mintNft(boredPetsNFT, TOKEN_OWNER);
    await marketplace.listNft(nftContract, tokenID, ether(".005"), {from: TOKEN_OWNER, value: listingFee});
    await marketplace.buyNft(nftContract, tokenID, {from: BUYER, value: ether(".005")});
    let expectedListing = {
      nftContract: nftContract,
      tokenId: tokenID,
      seller: TOKEN_OWNER,
      owner: BUYER,
      price: ether(".005"),
      listed: false
    };
    assertListing(getListing(await marketplace.getMyNfts({from: BUYER}), tokenID), expectedListing);
    await boredPetsNFT.approve(marketplace.address, tokenID, {from: BUYER});
    let txn = await marketplace.resellNft(nftContract, tokenID, ether(".005"), {from: BUYER, value: listingFee});
    expectedListing.seller = BUYER;
    expectedListing.owner = marketplace.address;
    expectedListing.listed = true;
    assertListing(getListing(await marketplace.getListedNfts(), tokenID), expectedListing);
    assertListing(getListing(await marketplace.getMyListedNfts({from: BUYER}), tokenID), expectedListing);
    delete expectedListing.listed;
    expectEvent(txn, "NFTListed", listingToString(expectedListing));
  });
});
