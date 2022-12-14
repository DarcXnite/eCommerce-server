const db = require("../models")
const bcrypt = require("bcrypt")
const jwt = require("jsonwebtoken")
const router = require("express").Router()
const authLockedRoute = require("./authLockedRoute")

// POST /users/register -- CREATE a new user
router.post("/register", async (req, res) => {
	try {
		// check if the user exists already
		const findUser = await db.User.findOne({
			email: req.body.email,
		})

		// disallow users from registering twice
		if (findUser) {
			// stop the route and send a response saying the user exists
			return res.status(400).json({ msg: "email already exists" })
		}

		// hash the user's pass
		const password = req.body.password
		const salts = 12
		const hashedPassword = await bcrypt.hash(password, salts)

		// create a new user with hashed password
		const newUser = new db.User({
			name: req.body.name,
			email: req.body.email,
			password: hashedPassword,
			pastOrders: [],
		})

		const newCart = await db.Cart.create({})

		newUser.cart = newCart
		await newUser.save()

		// sign the user in by sending a valid jwt back
		// create the jwt payload
		const payload = {
			name: newUser.name,
			email: newUser.email,
			id: newUser.id,
		}
		// sign the token and send it back
		const token = jwt.sign(payload, process.env.JWT_SECRET, {
			expiresIn: "1d",
		})
		res.json({ token })
	} catch (err) {
		console.warn(err)
		// handle validation errors
		if (err.name === "ValidationError") {
			res.status(400).json({ msg: err.message })
		} else {
			// handle all other errors
			res.status(500).json({ msg: "server error 500" })
		}
	}
})

// POST /users/login -- validate login creds
router.post("/login", async (req, res) => {
	try {
		// all the data will come in on the req.body
		// try to find the user in the database
		const foundUser = await db.User.findOne({
			email: req.body.email,
		})
		// if the user is not found, send a status of 400 let user know login failed
		if (!foundUser) {
			return res.status(400).json({ msg: "No user exists with that email" })
		}

		// check the supplied password against the password in the database
		// if they do not match, return and let the user know that the login has failed
		const passwordCheck = await bcrypt.compare(
			req.body.password,
			foundUser.password
		)
		if (!passwordCheck) {
			return res.status(400).json({ msg: "password and email doesnt match" })
		}

		// create a jwt payload
		const payload = {
			name: foundUser.name,
			email: foundUser.email,
			id: foundUser.id,
		}
		// sign the jwt and send it back
		const token = jwt.sign(payload, process.env.JWT_SECRET, {
			expiresIn: "1d",
		})
		res.json({ token })
	} catch (err) {
		console.warn(err)
		// dont forget to handle your errors
		if (err.name === "ValidationError") {
			res.status(400).json({ msg: err.message })
		} else {
			// handle all other errors
			res.status(500).json({ msg: "server error 500" })
		}
	}
})

// GET /auth-locked -- checks user creds and only send back privileged
// info if the user is logged in properly
router.get("/auth-locked", authLockedRoute, (req, res) => {
	console.table(res.locals.user)
	res.json({ msg: "welcome to the secret auth-locked route" })
})

// GET user data
router.get("/:id", async (req, res) => {
	const id = req.params.id

	try {
		const foundUser = await db.User.findById(id)
			.populate({
				path: "orders",
			})
			.populate({
				path: "cart",
			})

		res.json(foundUser)
	} catch (err) {
		console.warn(err)
	}
})

// PUT update user data
router.put("/:id", async (req, res) => {
	const id = req.params.id
	try {
		const foundUser = await db.User.findById(id)
		if (req.body.name) {
			foundUser.name = req.body.name
		}
		if (req.body.email) {
			foundUser.email = req.body.email
		}

		if (req.body.password) {
			// hash the user's pass
			const password = req.body.password
			const salts = 12
			const hashedPassword = await bcrypt.hash(password, salts)
			foundUser.password = hashedPassword
		}

		// jwt token for log in in
		const payload = {
			name: foundUser.name,
			email: foundUser.email,
			id: foundUser.id,
			pastOrders: foundUser.orders,
			cart: foundUser.cart,
		}
		// sign the jwt and send it back
		const token = jwt.sign(payload, process.env.JWT_SECRET, {
			expiresIn: "1d",
		})

		await foundUser.save()
		// res.json({ foundUser })
		res.status(201).json({ token })
	} catch (err) {
		console.warn(err)
		res
			.status(500)
			.json({ msg: "Something went wrong with updating your account details" })
	}
})

// DELETE user
router.delete("/:id", async (req, res) => {
	const id = req.params.id
	try {
		await db.User.findByIdAndDelete(id)
		res.json({ msg: "User deleted" })
	} catch (err) {
		console.warn(err)
	}
})

module.exports = router
